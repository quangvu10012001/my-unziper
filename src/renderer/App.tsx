import React, { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import { Button, Modal, Progress, message } from 'antd';
import 'antd/dist/reset.css'; // ✅ Ensure Ant Design styles are imported

// ✅ Ensure message notifications are visible & positioned correctly
message.config({
  top: 60, // Adjust if needed
  duration: 5, // Notifications stay visible for 2 seconds
});

const App: React.FC = () => {
  const [progress, setProgress] = useState<number>(0);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [zipFile, setZipFile] = useState<string | null>(null);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);

  useEffect(() => {
    if (window.electron && window.electron.onExtractProgress) {
      window.electron.onExtractProgress((progressValue: number) => {
        setProgress(progressValue);
        if (progressValue === 100) {
          message.success('✅ Extraction complete!');
          setTimeout(() => setModalVisible(false), 1000);
        }
      });
    }
  }, []);

  const handleSelectZip = async () => {
    if (!window.electron || !window.electron.selectZip) {
      message.error('❌ Cannot select ZIP file');
      return;
    }
    const filePath = await window.electron.selectZip();
    if (filePath) {
      setZipFile(filePath);
      message.success('📂 ZIP file selected');
    }
  };

  const handleSelectFolder = async () => {
    if (!window.electron || !window.electron.selectFolder) {
      message.error('❌ Cannot select output folder');
      return;
    }
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

    setProgress(0); // Reset progress before extraction
    setModalVisible(true); // Open the modal
    message.loading({ content: '⏳ Extracting ZIP file...', key: 'extract' });

    try {
      if (!window.electron || !window.electron.extractZip) {
        throw new Error('window.electron.extractZip is not available');
      }
      await window.electron.extractZip(zipFile, outputFolder);
      message.success({ content: '✅ Extraction complete!', key: 'extract' });
    } catch (error) {
      message.error({ content: `❌ Extraction failed: ${error}`, key: 'extract' });
      setModalVisible(false);
    }
  };

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#121212' }}>
      {/* 3D Background Scene */}
      <Canvas>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <OrbitControls />

        {/* Floating 3D Panel */}
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
              <h2 style={{ marginBottom: 20 }}>ZIP Extractor</h2>

              <Button
                type="primary"
                onClick={handleSelectZip}
                style={{
                  width: '100%',
                  backgroundColor: '#121212',
                  borderColor: '#fff',
                  color: '#fff',
                  marginBottom: 10,
                  fontWeight: 'bold',
                }}
              >
                Select ZIP File
              </Button>

              <Button
                type="primary"
                onClick={handleSelectFolder}
                style={{
                  width: '100%',
                  backgroundColor: '#121212',
                  borderColor: '#fff',
                  color: '#fff',
                  marginBottom: 10,
                  fontWeight: 'bold',
                }}
              >
                Select Output Folder
              </Button>

              <Button
                type="primary"
                onClick={handleExtractZip}
                disabled={!zipFile || !outputFolder}
                style={{
                  width: '100%',
                  backgroundColor: zipFile && outputFolder ? '#1890ff' : '#555',
                  borderColor: zipFile && outputFolder ? '#1890ff' : '#555',
                  color: 'white',
                  fontWeight: 'bold',
                }}
              >
                Extract ZIP
              </Button>
            </div>
          </Html>
        </mesh>
      </Canvas>

      {/* Progress Modal */}
      <Modal
        title="Extracting ZIP File"
        open={modalVisible}
        footer={null}
        style={{top: '50px'}}
        closable={false}
      >
        <Progress percent={progress} status={progress === 100 ? 'success' : 'active'} />
      </Modal>
    </div>
  );
};

export default App;
