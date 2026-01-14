
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ToolMode, FileData, ChatMessage } from './types';
import * as pdfService from './services/pdfService';

const App: React.FC = () => {
  const [mode, setMode] = useState<ToolMode>(ToolMode.HOME);
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('');
  const [outputFilename, setOutputFilename] = useState('result');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).map((f: File) => ({
        id: Math.random().toString(36).substring(2, 11),
        file: f,
        name: f.name,
        size: f.size
      }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const downloadBlob = (data: Uint8Array | Blob, fileName: string) => {
    const finalName = fileName.endsWith('.pdf') || fileName.endsWith('.doc') ? fileName : `${fileName}.pdf`;
    const blob = data instanceof Uint8Array ? new Blob([data], { type: 'application/pdf' }) : data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalName;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Saved as: ${finalName}`);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
    });
  };

  // --- Actions ---

  const runMerge = async () => {
    if (files.length < 2) return alert('Please upload at least 2 files to merge.');
    setLoading(true);
    try {
      const result = await pdfService.mergePdfs(files.map(f => f.file));
      downloadBlob(result, outputFilename || 'merged_ok');
    } catch (e) {
      console.error(e);
      alert('Error merging PDFs');
    } finally {
      setLoading(false);
    }
  };

  const runSplit = async () => {
    if (files.length === 0) return alert('Upload a file first.');
    const pages = prompt('Enter page numbers to extract (e.g. 1,3,5):');
    if (!pages) return;
    const pageArr = pages.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    setLoading(true);
    try {
      const result = await pdfService.splitPdf(files[0].file, pageArr);
      downloadBlob(result, outputFilename || 'split_ok');
    } catch (e) {
      console.error(e);
      alert('Error splitting PDF');
    } finally {
      setLoading(false);
    }
  };

  const runEdit = async () => {
    if (files.length === 0) return alert('Upload a file first.');
    const text = prompt('Enter watermark text:');
    if (!text) return;
    setLoading(true);
    try {
      const result = await pdfService.editPdf(files[0].file, text);
      downloadBlob(result, outputFilename || 'edited_ok');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const runRead = async () => {
    if (files.length === 0) return alert('Upload a file first.');
    if (!inputText) return;
    
    setLoading(true);
    const userMsg = inputText;
    setInputText('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const pdfText = await pdfService.extractText(files[0].file);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Document Content:\n${pdfText}\n\nUser Question: ${userMsg}`,
        config: { systemInstruction: "You are OK PDF AI. Help the user with their document." }
      });
      setChatHistory(prev => [...prev, { role: 'model', content: response.text || "No response." }]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const runTranslate = async () => {
    if (files.length === 0) return alert('Upload a file first.');
    setLoading(true);
    setStatus('Translating to Hindi...');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const pdfText = await pdfService.extractText(files[0].file);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate to Hindi:\n\n${pdfText.substring(0, 10000)}`,
      });
      const hindiText = response.text || "Translation failed.";
      const result = await pdfService.createPdfFromText(hindiText, "Hindi Translation");
      downloadBlob(result, outputFilename || 'hindi_ok');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const runConvertDoc = async () => {
    if (files.length === 0) return alert('Upload a file first.');
    setLoading(true);
    setStatus('Converting to Doc...');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const pdfText = await pdfService.extractText(files[0].file);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Format this text as a professional document:\n\n${pdfText}`,
      });
      const docContent = response.text || "";
      const blob = new Blob([docContent], { type: 'application/msword' });
      downloadBlob(blob, `${outputFilename || 'converted_ok'}.doc`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const runPhotoToPdf = async () => {
    if (files.length === 0) return alert('Upload a photo first.');
    setLoading(true);
    setStatus('Extracting text from photo...');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64 = await fileToBase64(files[0].file);
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: files[0].file.type } },
            { text: "Extract all English text from this image accurately. Return only the text content." }
          ]
        }
      });
      const extractedText = response.text || "No text found.";
      const result = await pdfService.createPdfFromText(extractedText, "Photo to PDF Result");
      downloadBlob(result, outputFilename || 'photo_ok');
    } catch (e) {
      console.error(e);
      alert('Error during photo conversion.');
    } finally {
      setLoading(false);
    }
  };

  const tools = [
    { id: ToolMode.READ, title: 'Read & Chat', icon: '📖', color: 'bg-orange-400', desc: 'Ask AI about your PDF' },
    { id: ToolMode.SPLIT, title: 'Split PDF', icon: '✂️', color: 'bg-orange-500', desc: 'Extract specific pages' },
    { id: ToolMode.MERGE, title: 'Merge PDF', icon: '🔗', color: 'bg-orange-600', desc: 'Combine multiple files' },
    { id: ToolMode.CONVERT_DOC, title: 'PDF to Doc', icon: '📄', color: 'bg-orange-700', desc: 'Format as Word document' },
    { id: ToolMode.EDIT, title: 'Edit PDF', icon: '✏️', color: 'bg-orange-300', desc: 'Add text overlays' },
    { id: ToolMode.TRANSLATE, title: 'Hindi Translate', icon: '🇮🇳', color: 'bg-orange-800', desc: 'EN to Hindi conversion' },
    { id: ToolMode.PHOTO_TO_PDF, title: 'Photo to PDF', icon: '📸', color: 'bg-orange-500', desc: 'English text photo to PDF' },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="gradient-bg p-6 text-white shadow-md">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setMode(ToolMode.HOME)}>
            <span className="text-3xl bg-white rounded-full p-1 leading-none">🍊</span>
            <h1 className="text-3xl font-bold tracking-tight">OK PDF</h1>
          </div>
          {mode !== ToolMode.HOME && (
            <button 
              onClick={() => { setMode(ToolMode.HOME); setFiles([]); setChatHistory([]); setStatus(''); }}
              className="bg-white text-orange-600 px-6 py-2 rounded-full transition text-sm font-bold shadow-sm"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6">
        {mode === ToolMode.HOME ? (
          <div className="py-12">
            <div className="text-center mb-16">
              <h2 className="text-6xl font-black text-orange-600 mb-4">OK PDF</h2>
              <p className="text-slate-600 text-xl font-medium">Simple. Vibrant. Smart PDF Utilities.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {tools.map(tool => (
                <button
                  key={tool.id}
                  onClick={() => setMode(tool.id)}
                  className="group bg-orange-50 p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-orange-100 flex flex-col items-center text-center transform hover:-translate-y-1"
                >
                  <div className={`${tool.color} w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4 text-white shadow-md group-hover:scale-110 transition-transform`}>
                    {tool.icon}
                  </div>
                  <h3 className="text-xl font-extrabold text-orange-900 mb-2">{tool.title}</h3>
                  <p className="text-orange-700 text-sm">{tool.desc}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border-2 border-orange-100 shadow-2xl p-8 min-h-[650px] flex flex-col">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-orange-100 p-4 rounded-2xl text-4xl text-orange-600">
                {tools.find(t => t.id === mode)?.icon}
              </div>
              <div>
                <h2 className="text-4xl font-black text-orange-600 uppercase tracking-wide">{tools.find(t => t.id === mode)?.title}</h2>
                <p className="text-slate-500 font-medium">Choose your files and rename your result below.</p>
              </div>
            </div>

            {/* Renaming & File List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="space-y-4">
                <label className="block text-sm font-bold text-orange-900">Output Filename</label>
                <input 
                  type="text" 
                  value={outputFilename}
                  onChange={(e) => setOutputFilename(e.target.value)}
                  placeholder="Enter filename (without extension)"
                  className="w-full px-5 py-4 rounded-2xl border-2 border-orange-100 focus:outline-none focus:border-orange-500 transition font-semibold"
                />
                
                <label className="border-4 border-dashed border-orange-100 rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-orange-50 transition group bg-white">
                  <input type="file" multiple accept={mode === ToolMode.PHOTO_TO_PDF ? "image/*" : ".pdf"} className="hidden" onChange={handleFileUpload} />
                  <span className="text-5xl mb-4 grayscale group-hover:grayscale-0 transition-all">📂</span>
                  <span className="font-black text-orange-600">UPLOAD {mode === ToolMode.PHOTO_TO_PDF ? "PHOTO" : "PDF"}</span>
                </label>
              </div>

              <div className="bg-orange-50 rounded-3xl p-6 border border-orange-100 overflow-y-auto max-h-[300px]">
                <h4 className="font-bold text-orange-900 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span> Selected Files
                </h4>
                {files.length === 0 ? (
                  <p className="text-orange-300 italic text-sm text-center py-10">No files uploaded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {files.map(f => (
                      <div key={f.id} className="bg-white p-3 rounded-xl flex items-center justify-between shadow-sm border border-orange-100">
                        <span className="text-sm font-bold text-orange-900 truncate pr-2">{f.name}</span>
                        <button onClick={() => removeFile(f.id)} className="text-orange-300 hover:text-red-500 transition font-black">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action Zone */}
            <div className="flex-1 flex flex-col">
              {mode === ToolMode.READ && (
                <div className="flex-1 flex flex-col bg-white rounded-3xl p-6 border-2 border-orange-100 overflow-hidden shadow-inner">
                  <div className="flex-1 overflow-y-auto space-y-4 p-2">
                    {chatHistory.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-orange-200">
                        <span className="text-7xl mb-4">💬</span>
                        <p className="font-black text-xl">OK PDF Chat is ready.</p>
                      </div>
                    )}
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-6 py-4 rounded-3xl ${msg.role === 'user' ? 'bg-orange-500 text-white font-bold' : 'bg-orange-50 text-orange-900 border border-orange-100 font-medium'}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {loading && <div className="text-orange-400 font-black italic text-sm p-2 animate-pulse">OK PDF is processing...</div>}
                  </div>
                  <div className="mt-4 flex gap-3">
                    <input 
                      type="text" 
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && runRead()}
                      placeholder="Ask about the document..."
                      className="flex-1 px-6 py-4 rounded-2xl border-2 border-orange-100 focus:outline-none focus:border-orange-500 font-semibold"
                    />
                    <button 
                      onClick={runRead}
                      disabled={loading}
                      className="bg-orange-600 text-white px-8 py-4 rounded-2xl hover:bg-orange-700 transition font-black disabled:opacity-50 shadow-lg"
                    >
                      SEND
                    </button>
                  </div>
                </div>
              )}

              {mode !== ToolMode.READ && (
                <div className="flex flex-col items-center justify-center py-10 bg-orange-50 rounded-3xl border border-orange-100">
                  <button
                    onClick={
                      mode === ToolMode.MERGE ? runMerge :
                      mode === ToolMode.SPLIT ? runSplit :
                      mode === ToolMode.EDIT ? runEdit :
                      mode === ToolMode.TRANSLATE ? runTranslate :
                      mode === ToolMode.CONVERT_DOC ? runConvertDoc :
                      mode === ToolMode.PHOTO_TO_PDF ? runPhotoToPdf : undefined
                    }
                    disabled={loading || files.length === 0}
                    className="bg-orange-600 text-white px-16 py-6 rounded-3xl text-2xl font-black hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-30 disabled:scale-100 tracking-wider uppercase"
                  >
                    {loading ? 'OK... WORKING' : `GENERATE ${tools.find(t => t.id === mode)?.title}`}
                  </button>
                  {status && <p className="mt-6 text-orange-600 font-black text-lg animate-bounce">✨ {status}</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="p-8 text-center text-orange-200 text-sm font-bold uppercase tracking-widest">
        OK PDF • QUALITY UTILITIES • 2024
      </footer>
    </div>
  );
};

export default App;
