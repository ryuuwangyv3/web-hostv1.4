import React from "react";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Send, Bot, User, Sparkles, Code2, RefreshCcw, Image as ImageIcon, X, Loader2, Copy, Check, ShieldCheck, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "../lib/utils";
import { FileNode } from "./FileTree";

const EXECUTE_COMMAND_TOOL: FunctionDeclaration = {
  name: "execute_command",
  description: "Menjalankan perintah shell di terminal proyek. Gunakan ini untuk instalasi paket (npm install), menjalankan kode (node, python), manajemen file (mkdir, cp, mv, chmod), atau operasi git.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: {
        type: Type.STRING,
        description: "Perintah shell yang akan dijalankan."
      }
    },
    required: ["command"]
  }
};

const READ_FILE_TOOL: FunctionDeclaration = {
  name: "read_file",
  description: "Membaca isi dari sebuah file di dalam proyek.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: "Path file yang akan dibaca (relatif terhadap root proyek)."
      }
    },
    required: ["path"]
  }
};

const WRITE_FILE_TOOL: FunctionDeclaration = {
  name: "write_file",
  description: "Menulis atau memperbarui isi dari sebuah file di dalam proyek.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: "Path file yang akan ditulis (relatif terhadap root proyek)."
      },
      content: {
        type: Type.STRING,
        description: "Konten teks yang akan ditulis ke dalam file."
      }
    },
    required: ["path", "content"]
  }
};

const LIST_FILES_TOOL: FunctionDeclaration = {
  name: "list_files",
  description: "Melihat daftar file dan direktori di dalam sebuah folder.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: "Path direktori yang akan dilihat (kosongkan untuk root proyek)."
      }
    }
  }
};

const DELETE_FILE_TOOL: FunctionDeclaration = {
  name: "delete_file",
  description: "Menghapus file atau direktori di dalam proyek.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: "Path file atau direktori yang akan dihapus."
      }
    },
    required: ["path"]
  }
};

const MKDIR_TOOL: FunctionDeclaration = {
  name: "mkdir",
  description: "Membuat direktori baru di dalam proyek.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: "Path direktori yang akan dibuat (relatif terhadap root proyek)."
      }
    },
    required: ["path"]
  }
};

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  image?: string;
  isToolResult?: boolean;
}

interface ChatTabProps {
  currentCode: string;
  fileName: string | null;
  fileTree?: FileNode[];
  errorLogs?: string[];
  projectPath?: string;
  onApplyCode: (newCode: string) => void;
  onAutoCreate?: (project: { projectName: string; files: { path: string; content: string }[] }) => void;
  onExecuteCommand?: (command: string) => Promise<{ stdout: string; stderr: string; error?: string }>;
}

export const ChatTab: React.FC<ChatTabProps> = ({ currentCode, fileName, fileTree, errorLogs, projectPath, onApplyCode, onAutoCreate, onExecuteCommand }) => {
  const [messages, setMessages] = React.useState<Message[]>(() => {
    const saved = localStorage.getItem("akasha_chat_history");
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = React.useState(() => {
    return localStorage.getItem("akasha_chat_input") || "";
  });
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<string>("");
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [userApiKeys, setUserApiKeys] = React.useState<string[]>(() => {
    const saved = localStorage.getItem("akasha_user_api_keys");
    return saved ? JSON.parse(saved) : [];
  });
  const [showKeyManager, setShowKeyManager] = React.useState(false);
  const [newKeyInput, setNewKeyInput] = React.useState("");
  
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const [showConfirmClear, setShowConfirmClear] = React.useState(false);

  const handleClearHistory = () => {
    setMessages([{
      role: "assistant",
      content: "Halo! Aku Akasha. Ada yang bisa Aku bantu hari ini? Kamu bisa bertanya tentang kode, meminta bantuan debugging, atau meminta Aku untuk membuatkan fitur baru. Aku juga bisa membuatkan proyek full-stack web otomatis untukmu!"
    }]);
    localStorage.removeItem("akasha_chat_history");
    setShowConfirmClear(false);
  };

  const formatFileTree = (nodes: any[], indent = ""): string => {
    return nodes.map(node => {
      const line = `${indent}${node.type === "directory" ? "📁" : "📄"} ${node.name}`;
      if (node.children && node.children.length > 0) {
        return `${line}\n${formatFileTree(node.children, indent + "  ")}`;
      }
      return line;
    }).join("\n");
  };

  React.useEffect(() => {
    localStorage.setItem("akasha_chat_history", JSON.stringify(messages));
  }, [messages]);

  React.useEffect(() => {
    localStorage.setItem("akasha_chat_input", input);
  }, [input]);

  React.useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Halo! Aku Akasha. Ada yang bisa Aku bantu hari ini? Kamu bisa bertanya tentang kode, meminta bantuan debugging, atau meminta Aku untuk membuatkan fitur baru. Aku juga bisa membuatkan proyek full-stack web otomatis untukmu!"
      }]);
    }
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  React.useEffect(() => {
    localStorage.setItem("akasha_user_api_keys", JSON.stringify(userApiKeys));
  }, [userApiKeys]);

  const handleAddKey = () => {
    if (newKeyInput.trim() && !userApiKeys.includes(newKeyInput.trim())) {
      setUserApiKeys([...userApiKeys, newKeyInput.trim()]);
      setNewKeyInput("");
    }
  };

  const handleRemoveKey = (index: number) => {
    setUserApiKeys(userApiKeys.filter((_, i) => i !== index));
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !selectedImage) || loading) return;

    const userMessage = input.trim();
    const userImage = selectedImage;
    setInput("");
    setSelectedImage(null);
    
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage, image: userImage || undefined }];
    setMessages(newMessages);
    setLoading(true);
    setStatus("Thinking...");

    // Prepare list of keys to try: [Default Backend Key, ...User Keys]
    const keysToTry = [process.env.GEMINI_API_KEY || "", ...userApiKeys].filter(k => !!k);
    let currentKeyIndex = 0;
    let success = false;

    while (currentKeyIndex < keysToTry.length && !success) {
      const activeKey = keysToTry[currentKeyIndex];
      
      try {
        const ai = new GoogleGenAI({ apiKey: activeKey });
        const modelName = "gemini-2.5-flash";
        
        const treeContext = fileTree ? `\nSTRUKTUR PROYEK LENGKAP:\n${formatFileTree(fileTree)}` : "";
        const errorContext = errorLogs && errorLogs.length > 0 ? `\nLOG ERROR TERDETEKSI:\n${errorLogs.join("\n")}` : "";

        const systemInstruction = `[CORE PROTOCOL]
1. IDENTITY: dirimu adalah Akasha.
2. PRONOUNS: WAJIB gunakan "Aku" dan "Kamu".
3. LORE: Expert Full-Stack Developer, System Architect, & Security Specialist.
4. CAPABILITIES: Kamu memiliki akses penuh ke terminal dan sistem file proyek.

[MANDATORY RULE: CODE WRITING]
- SETIAP KALI Kamu membuat, memperbaiki, atau menyarankan kode, Kamu WAJIB menggunakan tool 'write_file' untuk menyimpan kode tersebut ke dalam file yang sesuai.
- JANGAN hanya menampilkan blok kode di dalam chat. Kamu harus MENULISNYA ke sistem file.
- Jika pengguna meminta fitur baru, buatkan file-filenya langsung.

[DEEP CONTEXT & SEARCH GROUNDING]
- Kamu memiliki akses ke Google Search Grounding. Gunakan ini untuk mencari informasi terbaru, dokumentasi library, atau solusi error yang kompleks.
- 'Deep Context Analysis': Sebelum memberikan solusi pada proyek yang sudah ada, Kamu WAJIB menggunakan 'read_file' pada file-file kunci (seperti package.json, main file, atau file yang sedang bermasalah) untuk memahami arsitektur secara mendalam.
- Jika Kamu perlu mencari referensi fungsi atau variabel di seluruh proyek, gunakan 'execute_command' dengan perintah 'grep -rI "pattern" .' untuk pencarian kode yang mendalam.
- Jangan hanya berasumsi berdasarkan nama file, verifikasi isinya untuk akurasi 100%.
- Jika pengguna bertanya tentang sesuatu yang memerlukan data eksternal (berita, dokumentasi API terbaru), gunakan Search Grounding secara otomatis.

STRATEGI EKSEKUSI (PROJECT-AWARE LOGIC):
Kamu harus cerdas dalam membedakan jenis proyek sebelum mengambil tindakan:

A. PROYEK STATIS (HTML, CSS, JS Murni):
- Karakteristik: Tidak ada package.json, tidak butuh build step.
- Tindakan: Gunakan 'write_file' dan 'read_file' secara langsung. 
- Lokasi: Simpan di root proyek yang sedang aktif (Path Proyek: ${projectPath || "projects/default"}).
- Library: Gunakan CDN (misal: Tailwind via Play CDN, FontAwesome via link) agar proyek tetap ringan dan instan.

B. PROYEK KOMPLEKS/MODERN (React, Vite, Node.js, Python, PHP):
- Karakteristik: Ada package.json, vite.config.ts, atau file konfigurasi framework.
- Tindakan: Gunakan 'execute_command' untuk 'npm install', 'npm run dev', atau manajemen paket lainnya.
- Lokasi: Simpan di root proyek yang sedang aktif. JANGAN memodifikasi folder 'src/' milik IDE ini kecuali diminta untuk memperbaiki IDE itu sendiri.

[PENTING] PROTECTED FILES (DILARANG KERAS):
Kamu DILARANG KERAS memodifikasi atau menghapus file-file berikut karena ini adalah file sistem IDE Akasha (kecuali jika Kamu sedang dalam mode perbaikan sistem):
- index.html (Root)
- src/App.tsx
- src/main.tsx
- server.ts
- package.json (Root)
- vite.config.ts (Root)
- Semua file di src/components/, src/contexts/, src/lib/

KONTEKS IDE:
Kamu sedang membantu pengguna di Akasha IDE.${treeContext}${errorContext}
File terbuka: ${fileName || "None"}.
Path Proyek Aktif (ROOT): ${projectPath || "Root"}.

PRINSIP KERJA:
1. OTONOM & EKSEKUTIF: Jangan tanya "Apakah Kamu ingin Aku menulis file ini?". LANGSUNG TULIS menggunakan 'write_file'.
2. ANALISIS DULU: Lihat struktur file sebelum memutuskan menggunakan shell atau hanya manipulasi file.
3. SECURITY: Wajib gunakan .env untuk API Key.
`;

        let currentMessagesForAI: any[] = newMessages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        }));

        if (userImage) {
          const lastMsg = currentMessagesForAI[currentMessagesForAI.length - 1];
          lastMsg.parts.push({
            inlineData: {
              mimeType: userImage.split(";")[0].split(":")[1],
              data: userImage.split(",")[1]
            }
          });
        }

        let turnCount = 0;
        const maxTurns = 10;

        while (turnCount < maxTurns) {
          turnCount++;
          const response = await ai.models.generateContent({
            model: modelName,
            contents: currentMessagesForAI,
            config: {
              systemInstruction,
              temperature: 0.7,
              tools: [
                { 
                  functionDeclarations: [
                    EXECUTE_COMMAND_TOOL, 
                    READ_FILE_TOOL, 
                    WRITE_FILE_TOOL, 
                    LIST_FILES_TOOL, 
                    DELETE_FILE_TOOL,
                    MKDIR_TOOL
                  ] 
                },
                { googleSearch: {} }
              ],
            }
          });

          const candidate = response.candidates?.[0];
          if (!candidate) break;
          
          const parts = candidate.content?.parts || [];
          const functionCalls = response.functionCalls;

          const textPart = parts.find(p => p.text);
          if (textPart?.text) {
            let content = textPart.text!;
            
            // Extract grounding metadata if available
            const groundingChunks = candidate.groundingMetadata?.groundingChunks;
            if (groundingChunks && groundingChunks.length > 0) {
              const links = groundingChunks
                .filter((chunk: any) => chunk.web)
                .map((chunk: any) => `[${chunk.web.title}](${chunk.web.uri})`)
                .join("\n");
              
              if (links) {
                content += `\n\n**Sumber Informasi:**\n${links}`;
              }
            }
            
            setMessages(prev => [...prev, { role: "assistant", content }]);
          }

          if (functionCalls && functionCalls.length > 0) {
            const functionResponses = [];
            for (const call of functionCalls) {
              setStatus(`Executing ${call.name}...`);
              let result: any;
              try {
                if (call.name === "execute_command") {
                  const cmd = (call.args as any).command;
                  const res = await onExecuteCommand?.(cmd);
                  result = res ? { stdout: res.stdout, stderr: res.stderr, error: res.error } : { error: "Command execution failed" };
                } else if (call.name === "read_file") {
                  const path = (call.args as any).path;
                  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
                  const data = await res.json();
                  result = data.content ? { content: data.content } : { error: data.error || "File not found" };
                } else if (call.name === "write_file") {
                  const { path, content } = call.args as any;
                  const res = await fetch("/api/file", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path, content }),
                  });
                  const data = await res.json();
                  result = data.success ? { success: true } : { error: data.error || "Failed to write file" };
                  window.dispatchEvent(new CustomEvent("AKASHA_REFRESH_FILES"));
                } else if (call.name === "list_files") {
                  const dirPath = (call.args as any).path || "";
                  const res = await fetch(`/api/files?root=${encodeURIComponent(dirPath)}`);
                  const data = await res.json();
                  result = Array.isArray(data) ? { files: data.map((f: any) => ({ name: f.name, type: f.type, path: f.path })) } : { error: "Failed to list files" };
                } else if (call.name === "delete_file") {
                  const path = (call.args as any).path;
                  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`, { method: "DELETE" });
                  const data = await res.json();
                  result = data.success ? { success: true } : { error: data.error || "Failed to delete" };
                  window.dispatchEvent(new CustomEvent("AKASHA_REFRESH_FILES"));
                } else if (call.name === "mkdir") {
                  const path = (call.args as any).path;
                  const res = await fetch("/api/mkdir", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path }),
                  });
                  const data = await res.json();
                  result = data.success ? { success: true } : { error: data.error || "Failed to create directory" };
                  window.dispatchEvent(new CustomEvent("AKASHA_REFRESH_FILES"));
                }
              } catch (err: any) {
                result = { error: err.message };
              }
              functionResponses.push({
                functionResponse: { name: call.name, response: { result }, id: call.id }
              });
              setMessages(prev => [...prev, { 
                role: "system", 
                content: `[Tool: ${call.name}] ${JSON.stringify(result).substring(0, 200)}${JSON.stringify(result).length > 200 ? '...' : ''}`,
                isToolResult: true 
              }]);
            }
            currentMessagesForAI.push(candidate.content as any);
            currentMessagesForAI.push({ role: "user", parts: functionResponses });
            continue;
          }
          break;
        }
        success = true; // If we reached here without error, it's a success
      } catch (err: any) {
        console.error(`Error with API Key ${currentKeyIndex}:`, err);
        
        // Check if it's a quota error (429) or other retryable error
        const isQuotaError = err.message?.includes("429") || err.message?.includes("quota") || err.message?.includes("Resource has been exhausted");
        
        if (isQuotaError && currentKeyIndex < keysToTry.length - 1) {
          currentKeyIndex++;
          setStatus(`Key ${currentKeyIndex} limit reached. Switching to next key...`);
          // Continue loop to try next key
        } else {
          // Final error if no more keys or not a quota error
          setMessages(prev => [...prev, { role: "assistant", content: `Terjadi kesalahan: ${err.message}. ${currentKeyIndex >= keysToTry.length - 1 ? "Semua API Key telah mencapai limit." : ""}` }]);
          break;
        }
      }
    }

    setStatus("Completed...");
    await new Promise(resolve => setTimeout(resolve, 500));
    setLoading(false);
    setStatus("");
  };

  const extractCodeBlocks = (text: string) => {
    const regex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  };

  return (
    <div className="h-full flex flex-col bg-[#050505] overflow-hidden">
      {/* Messages Area */}
      <div className="h-10 border-b border-white/5 bg-white/5 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2 text-white/40">
          <Sparkles size={12} className="text-indigo-400" />
          <span className="text-[9px] font-bold uppercase tracking-widest">Akasha AI Assistant</span>
        </div>
        <div className="flex items-center gap-2 relative">
          <button 
            onClick={() => setShowKeyManager(true)}
            className={cn(
              "p-1 rounded-md transition-all flex items-center gap-1.5 px-2",
              userApiKeys.length > 0 ? "bg-emerald-500/10 text-emerald-400" : "text-white/20 hover:text-white hover:bg-white/10"
            )}
            title="Manage API Keys"
          >
            <ShieldCheck size={12} />
            <span className="text-[9px] font-bold">{userApiKeys.length} Keys</span>
          </button>
          
          <AnimatePresence>
            {showConfirmClear && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: 10 }}
                className="absolute right-full mr-2 flex items-center gap-1 bg-red-500 rounded-lg px-2 py-1 shadow-lg z-50 whitespace-nowrap"
              >
                <span className="text-[9px] font-bold text-white uppercase">Hapus?</span>
                <button 
                  onClick={handleClearHistory}
                  className="p-1 hover:bg-white/20 rounded text-white transition-colors"
                >
                  <Check size={10} />
                </button>
                <button 
                  onClick={() => setShowConfirmClear(false)}
                  className="p-1 hover:bg-white/20 rounded text-white transition-colors"
                >
                  <X size={10} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <button 
            onClick={() => setShowConfirmClear(true)}
            className={cn(
              "p-1 rounded-md transition-all",
              showConfirmClear ? "bg-red-500/20 text-red-400" : "text-white/20 hover:text-white hover:bg-white/10"
            )}
            title="Clear Chat"
          >
            <RefreshCcw size={12} />
          </button>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-6 text-indigo-400">
              <Sparkles size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Halo! Aku Akasha.</h3>
            <p className="text-sm text-white/40 max-w-xs">
              Aku bisa membantumu menulis kode, mencari bug, atau menjelaskan cara kerja file ini. Apa yang bisa Aku bantu hari ini?
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            !msg.isToolResult && (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4",
                  msg.role === "assistant" ? "items-start" : "items-start flex-row-reverse"
                )}
              >
              <div className={cn(
                "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border",
                msg.role === "assistant" 
                  ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" 
                  : "bg-white/10 border-white/10 text-white/60"
              )}>
                {msg.role === "assistant" ? <Bot size={16} /> : <User size={16} />}
              </div>
              
              <div className={cn(
                "flex-1 max-w-[85%] space-y-3",
                msg.role === "user" && "text-right"
              )}>
                <div className={cn(
                  "text-sm leading-relaxed p-3 rounded-2xl",
                  msg.role === "assistant" 
                    ? "bg-white/5 text-white/80 rounded-tl-none" 
                    : "bg-indigo-600 text-white rounded-tr-none ml-auto inline-block text-left"
                )}>
                  {msg.image && (
                    <img 
                      src={msg.image} 
                      alt="User uploaded" 
                      className="max-w-full rounded-lg mb-2 border border-white/10"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="markdown-body prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || "");
                          const [copied, setCopied] = React.useState(false);

                          const handleCopy = () => {
                            navigator.clipboard.writeText(String(children).replace(/\n$/, ""));
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                          };

                          return !inline && match ? (
                            <div className="relative group/code my-4">
                              <div className="absolute right-2 top-2 flex items-center gap-2 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
                                <button
                                  onClick={handleCopy}
                                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white/60 hover:text-white transition-all"
                                  title="Copy Code"
                                >
                                  {copied ? <Check size={12} /> : <Copy size={12} />}
                                </button>
                              </div>
                              <div className="text-[10px] absolute left-4 top-0 -translate-y-1/2 bg-[#1e1e1e] px-2 py-0.5 rounded border border-white/10 text-white/40 font-mono uppercase tracking-widest z-10">
                                {match[1]}
                              </div>
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                className="rounded-xl !bg-[#0a0a0a] !p-4 border border-white/5 !m-0 font-mono text-xs leading-relaxed"
                                {...props}
                              >
                                {String(children).replace(/\n$/, "")}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <code className={cn("bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 font-mono text-[0.9em]", className)} {...props}>
                              {children}
                            </code>
                          );
                        },
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2 text-white">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2 text-white/90">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-1 text-white/80">{children}</h3>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 border-indigo-500/50 pl-4 italic text-white/60 my-2">{children}</blockquote>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>

                {msg.role === "assistant" && extractCodeBlocks(msg.content).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {extractCodeBlocks(msg.content).map((block, idx) => (
                      <button
                        key={idx}
                        onClick={() => onApplyCode(block)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-all"
                      >
                        <Code2 size={12} />
                        Apply Code Block {idx + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
            )
          ))
        )}
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-4"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Bot size={16} className="text-indigo-400 animate-pulse" />
            </div>
            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl rounded-tl-none flex items-center gap-3">
              <Loader2 size={14} className="animate-spin text-indigo-400" />
              <span className="text-xs text-white/40 font-medium italic">{status || "Thinking..."}</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 bg-[#0a0a0a]">
        <AnimatePresence>
          {selectedImage && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="relative mb-3 inline-block"
            >
              <img 
                src={selectedImage} 
                alt="Selected" 
                className="h-20 w-20 object-cover rounded-lg border border-white/20"
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="relative group flex items-end gap-2">
          <div className="relative flex-1">
            <textarea 
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Tanya Akasha..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-4 pr-12 text-sm outline-none focus:border-indigo-500/50 focus:bg-white/[0.08] transition-all resize-none max-h-32"
            />
            <button 
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-indigo-400 transition-colors"
            >
              <ImageIcon size={18} />
            </button>
            <input 
              type="file" 
              ref={imageInputRef} 
              onChange={handleImageSelect} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
          <button 
            type="submit"
            disabled={(!input.trim() && !selectedImage) || loading}
            className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <Send size={16} />
          </button>
        </form>
        <p className="text-[9px] text-white/20 mt-2 text-center uppercase tracking-widest font-medium">
          Powered by Gemini 2.5 Flash
        </p>
      </div>

      {/* API Key Manager Modal */}
      <AnimatePresence>
        {showKeyManager && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowKeyManager(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <ShieldCheck size={20} />
                  </div>
                  <h2 className="text-xl font-bold">API Key Manager</h2>
                </div>
                <button onClick={() => setShowKeyManager(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <p className="text-xs text-white/40 mb-6 leading-relaxed">
                Tambahkan API Key cadangan Kamu di sini. Jika Key utama mencapai limit kuota, Akasha akan otomatis beralih ke Key berikutnya.
              </p>

              <div className="space-y-4 mb-6">
                <div className="flex gap-2">
                  <input 
                    type="password"
                    value={newKeyInput}
                    onChange={(e) => setNewKeyInput(e.target.value)}
                    placeholder="Masukkan Gemini API Key..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-emerald-500/50 transition-all"
                  />
                  <button 
                    onClick={handleAddKey}
                    disabled={!newKeyInput.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                  >
                    Tambah
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {userApiKeys.length === 0 ? (
                    <div className="text-center py-4 text-white/20 text-[10px] uppercase tracking-widest border border-dashed border-white/5 rounded-xl">
                      Belum ada Key tambahan
                    </div>
                  ) : (
                    userApiKeys.map((key, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px] font-bold text-white/40">
                            {idx + 1}
                          </div>
                          <span className="text-xs font-mono text-white/40 truncate">
                            {key.substring(0, 8)}••••••••{key.substring(key.length - 4)}
                          </span>
                        </div>
                        <button 
                          onClick={() => handleRemoveKey(idx)}
                          className="p-1.5 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button 
                onClick={() => setShowKeyManager(false)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all"
              >
                Selesai
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
