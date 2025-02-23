/* eslint-disable prefer-promise-reject-errors */
/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import extract from 'extract-zip';
import fs from 'fs';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

const { https } = require('follow-redirects');

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.handle('downloadFile', async (event, fileUrl, outputFolder) => {
  if (!fileUrl || !outputFolder) {
    throw new Error('Invalid URL or output folder');
  }

  const fileName =
    path.basename(new URL(fileUrl).pathname) || 'downloaded_file';
  const filePath = path.join(outputFolder, fileName);

  console.log(`📥 Downloading: ${fileUrl}`);
  console.log(`💾 Saving to: ${filePath}`);

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    event.sender.send('download-progress', 0); // Initial progress

    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0' }, // Avoid 403 errors
    };

    https
      .get(fileUrl, options, (response) => {
        console.log(`🔍 Response Status: ${response.statusCode}`);

        if (response.statusCode >= 400) {
          console.error(`❌ Download failed: ${response.statusCode}`);
          reject(`Failed to download file: ${response.statusCode}`);
          return;
        }

        const totalSize = parseInt(response.headers['content-length'], 10) || 0;
        let downloadedSize = 0;

        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          const progress = totalSize
            ? Math.round((downloadedSize / totalSize) * 100)
            : 0;
          event.sender.send('download-progress', progress);
          console.log(`📊 Download progress: ${progress}%`);
        });

        response.pipe(file);
        file.on('finish', () => {
          console.log(`✅ Download complete: ${filePath}`);
          event.sender.send('download-progress', 100);
          file.close(() => resolve(filePath));
        });
      })
      .on('error', (error) => {
        console.error(`❌ Download error: ${error.message}`);
        fs.unlink(filePath, () => reject(error.message));
      });
  });
});

ipcMain.handle('select-zip', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'ZIP Files', extensions: ['zip'] }],
  });
  return filePaths[0] || null;
});

ipcMain.handle('select-folder', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return filePaths[0] || null;
});

ipcMain.handle('extract-zip', async (_, zipPath, outputPath) => {
  try {
    const fileList = await getFileList(zipPath);
    const totalFiles = fileList.length;
    let extractedFiles = 0;

    await extract(zipPath, {
      dir: outputPath,
      onEntry: () => {
        extractedFiles++;
        const progress = Math.round((extractedFiles / totalFiles) * 100);
        mainWindow?.webContents.send('extract-progress', progress);
      },
    });

    return 'Extraction successful!';
  } catch (error) {
    throw new Error(`Extraction failed: ${error}`);
  }
});

// Function to list files inside the ZIP
const getFileList = async (zipPath: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .on('error', reject)
      .on('data', (chunk) => {
        resolve(chunk.toString().split('\n')); // Mock file listing (extract-zip does not provide a direct method)
      });
  });
};

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1080,
    center: true,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
