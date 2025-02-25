import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { Button, Modal, Progress, message, Input } from 'antd';
import 'antd/dist/reset.css';

message.config({ top: 80, duration: 2 });
// Custom Styled Button Component
const StyledButton: React.FC<{
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ onClick, disabled, children }) => {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        marginBottom: 10,
        background: disabled ? '#555' : 'linear-gradient(to right, #0ef, #08f)',
        border: 'none',
        color: disabled ? '#aaa' : 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.3s ease-in-out',
        filter: disabled ? 'none' : 'brightness(1)', // Normal state
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.filter = 'brightness(1.2)';
      }}
      onMouseLeave={(e) => {
        if (!disabled) e.currentTarget.style.filter = 'brightness(1)';
      }}
    >
      {children}
    </Button>
  );
};

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true); // Splash screen state
  const [progress, setProgress] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [zipFile, setZipFile] = useState<string | null>(null);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string>('');
  const [modalTitle, setModalTitle] = useState<string>(''); // Dynamic title for modal

  useEffect(() => {
    setTimeout(() => setIsLoading(false), 3000); // Show splash screen for 3 sec

    if (window.electron) {
      window.electron.onExtractProgress((progressValue: number) => {
        setProgress(progressValue);
        if (progressValue === 100) {
          message.success('✅ Extraction complete!');
          setTimeout(() => setModalVisible(false), 1000);
        }
      });

      window.electron.onDownloadProgress((progressValue: number) => {
        console.log(`📊 Download Progress: ${progressValue}%`);
        setProgress(progressValue);

        if (progressValue === 100) {
          message.success('✅ Download complete!');
          setTimeout(() => setModalVisible(false), 1000);
        }
      });
    }
  }, []);

  const handleSelectZip = async () => {
    const filePath = await window.electron.selectZip();
    if (filePath) {
      setZipFile(filePath);
      message.success('📂 ZIP file selected');
    }
  };

  const handleSelectFolder = async () => {
    const folderPath = await window.electron.selectFolder();
    if (folderPath) {
      setOutputFolder(folderPath);
      message.success('📁 Output folder selected');
    }
  };

  const handleExtractZip = async () => {
    if (!zipFile || !outputFolder) {
      message.error('⚠️ Please select a ZIP file and an output folder');
      return;
    }

    setProgress(0);
    setModalTitle('Extracting ZIP File');
    setModalVisible(true);
    message.loading({ content: '⏳ Extracting ZIP file...', key: 'extract' });

    try {
      await window.electron.extractZip(zipFile, outputFolder);
      message.success({ content: '✅ Extraction complete!', key: 'extract' });
    } catch (error) {
      message.error({
        content: `❌ Extraction failed: ${error}`,
        key: 'extract',
      });
      setModalVisible(false);
    }
  };

  const handleDownload = async () => {
    if (!downloadUrl || !outputFolder) {
      message.error('⚠️ Please enter a valid URL and select an output folder');
      return;
    }

    setProgress(0);
    setModalTitle('Downloading File');
    setModalVisible(true);
    message.loading({ content: '⏳ Downloading file...', key: 'download' });

    console.log(`📥 Starting download from: ${downloadUrl}`);
    console.log(`💾 Saving to: ${outputFolder}`);

    try {
      await window.electron.downloadFile(downloadUrl, outputFolder);
      message.success({ content: '✅ Download complete!', key: 'download' });
    } catch (error) {
      message.error({
        content: `❌ Download failed: ${error}`,
        key: 'download',
      });
      setModalVisible(false);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#121212',
          color: 'white',
          flexDirection: 'column',
        }}
      >
        {/* 🔥 Samsung One UI Loading Spinner */}
        <div className="samsung-loader"></div>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '20px' }}>
          My Unzip Tool
        </h2>

        {/* Samsung Spinner CSS */}
        <style>
          {`
          .samsung-loader {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: 4px solid transparent;
            border-top: 4px solid #0ef;  /* Samsung Neon Blue */
            border-left: 4px solid #0ef;
            animation: rotate 1s linear infinite;
          }

          @keyframes rotate {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
        </style>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#121212' }}>
      <Canvas>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls />

        <mesh position={[0, 1, 0]} rotation={[0.2, 0.2, 0]}>
          <boxGeometry args={[3, 2, 0.2]} />
          <meshStandardMaterial color="#333" />
          <Html center>
            <div
              style={{
                width: '300px',
                padding: '20px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '15px',
                backdropFilter: 'blur(10px)',
                color: 'white',
                textAlign: 'center',
                boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
              }}
            >
              <h2 style={{ marginBottom: 20 }}>ZIP Extractor & Downloader</h2>
              <Input
                placeholder="Enter file URL"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                style={{ marginBottom: 10 }}
              />
              <Button
                type="primary"
                onClick={handleDownload}
                style={{ width: '100%', marginBottom: 10 }}
              >
                Download File
              </Button>
              <Button
                type="primary"
                onClick={handleSelectZip}
                style={{ width: '100%', marginBottom: 10 }}
              >
                Select ZIP File
              </Button>
              <Button
                type="primary"
                onClick={handleSelectFolder}
                style={{ width: '100%', marginBottom: 10 }}
              >
                Select Output Folder
              </Button>
              <StyledButton onClick={handleExtractZip} disabled={!zipFile || !outputFolder}>
                {!zipFile || !outputFolder ? 'Extract ZIP' : 'Extract ZIP'}
              </StyledButton>
            </div>
          </Html>
        </mesh>
      </Canvas>

      {/* 🔥 Modal for Download and Extraction Progress */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        footer={null}
        closable={false}
      >
        <Progress
          percent={progress}
          status={progress === 100 ? 'success' : 'active'}
        />
      </Modal>
    </div>
  );
};

export default App;
