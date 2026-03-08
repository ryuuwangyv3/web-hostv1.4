import React from "react";
import { Settings as SettingsIcon, Monitor, Type, Shield, Zap, Globe, Database } from "lucide-react";
import { motion } from "motion/react";
import { useSettings } from "../contexts/SettingsContext";
import { vfs } from "../lib/vfs";

export const SettingsTab: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const [storageInfo, setStorageInfo] = React.useState<{ usage: number; quota: number }>({ usage: 0, quota: 0 });

  React.useEffect(() => {
    const fetchStorage = async () => {
      const info = await vfs.getQuota();
      setStorageInfo(info);
    };
    fetchStorage();
    const interval = setInterval(fetchStorage, 5000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const toggleFeature = (key: keyof typeof settings) => {
    if (typeof settings[key] === 'boolean') {
      updateSettings({ [key]: !settings[key] });
    }
  };

  const features = [
    { label: "Auto-save changes", key: "autoSave" as const },
    { label: "Enable AI code suggestions", key: "aiSuggestions" as const },
    { label: "Show line numbers", key: "showLineNumbers" as const },
    { label: "Word wrap", key: "wordWrap" as const },
    { label: "Format on save", key: "formatOnSave" as const }
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto w-full space-y-8 overflow-y-auto h-full scrollbar-hide">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-sm text-white/40">Configure your Akasha IDE experience.</p>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-indigo-400">
            <Monitor size={18} />
            <h3 className="text-sm font-bold uppercase tracking-widest">Appearance</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <label className="text-xs font-bold text-white/60">Editor Theme</label>
              <select 
                value={settings.theme}
                onChange={(e) => updateSettings({ theme: e.target.value })}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-500 transition-all"
              >
                <option value="dark-plus">Akasha Dark Plus</option>
                <option value="midnight">Midnight OLED</option>
                <option value="cyberpunk">Cyberpunk Neon</option>
                <option value="minimal">Minimalist Gray</option>
              </select>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <label className="text-xs font-bold text-white/60">Font Size</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="10" 
                  max="24" 
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: parseInt(e.target.value) })}
                  className="flex-1 accent-indigo-500"
                />
                <span className="text-xs font-mono text-indigo-400 w-8">{settings.fontSize}px</span>
              </div>
            </div>
          </div>
        </div>

        {/* Editor Features */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Type size={18} />
            <h3 className="text-sm font-bold uppercase tracking-widest">Editor Features</h3>
          </div>
          
          <div className="space-y-2">
            {features.map((feature, i) => (
              <div 
                key={i} 
                className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl cursor-pointer hover:bg-white/[0.07] transition-colors"
                onClick={() => toggleFeature(feature.key)}
              >
                <span className="text-xs text-white/80">{feature.label}</span>
                <div className={`w-8 h-4 rounded-full relative transition-all ${settings[feature.key] ? 'bg-indigo-600' : 'bg-white/10'}`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${settings[feature.key] ? 'right-0.5' : 'left-0.5'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security & System */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-purple-400">
            <Shield size={18} />
            <h3 className="text-sm font-bold uppercase tracking-widest">Security & System</h3>
          </div>
          
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold">Protocol Isolation</h4>
                <p className="text-[10px] text-white/40">Ensures your code runs in a secure sandbox.</p>
              </div>
              <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[9px] font-bold text-emerald-400 uppercase">Active</div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold">API Key Protection</h4>
                <p className="text-[10px] text-white/40">Sensitive keys are never exposed to the client.</p>
              </div>
              <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[9px] font-bold text-emerald-400 uppercase">Secure</div>
            </div>
          </div>
        </div>

        {/* VFS Storage */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-amber-400">
            <Database size={18} />
            <h3 className="text-sm font-bold uppercase tracking-widest">VFS Storage</h3>
          </div>
          
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60 font-bold">Storage Usage</span>
                <span className="text-amber-400 font-mono">{formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota || 5 * 1024 * 1024 * 1024)}</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-500" 
                  style={{ width: `${Math.min(100, (storageInfo.usage / (storageInfo.quota || 5 * 1024 * 1024 * 1024)) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-white/40 italic">
                VFS storage is powered by IndexedDB, supporting projects up to 5GB+.
              </p>
            </div>
            
            <button 
              onClick={async () => {
                if (confirm("Are you sure you want to clear all local VFS data? This will not affect server files.")) {
                  await vfs.clearAll();
                  const info = await vfs.getQuota();
                  setStorageInfo(info);
                }
              }}
              className="w-full py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] font-bold text-red-400 uppercase hover:bg-red-500/20 transition-all"
            >
              Clear Local VFS Cache
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-white/5 flex items-center justify-between text-[10px] text-white/20 uppercase tracking-widest font-bold">
          <span>Akasha IDE v1.2.0</span>
          <div className="flex items-center gap-4">
            <button className="hover:text-white transition-colors">Documentation</button>
            <button className="hover:text-white transition-colors">Support</button>
          </div>
        </div>
      </div>
    </div>
  );
};
