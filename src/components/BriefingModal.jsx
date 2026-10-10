import React, { useState } from 'react';
import { X, Copy, Check, Download, FileText, Shield, ExternalLink } from 'lucide-react';

export default function BriefingModal({
  isOpen,
  onClose,
  briefingData
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !briefingData) return null;

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(briefingData.markdown_content || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([briefingData.markdown_content || ''], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${briefingData.report_id || 'ESA-CAR-REPORT'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(briefingData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${briefingData.report_id || 'ESA-CAR-REPORT'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-text">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in duration-200 text-slate-800">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between font-sans">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 font-sans tracking-tight">
                ESA Conjunction Assessment Report (CAR)
              </h3>
              <p className="text-xs text-slate-500 font-sans">
                Ref: <span className="tabular-nums text-teal-700 font-medium">{briefingData.report_id}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Formatted CAR Document Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-sans text-xs text-slate-800 bg-slate-50">
          <pre className="whitespace-pre-wrap font-sans tabular-nums leading-relaxed bg-white p-5 rounded-xl border border-slate-200 shadow-2xs text-slate-800">
            {briefingData.markdown_content}
          </pre>
        </div>

        {/* Modal Action Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between font-sans">
          <div className="text-[11px] text-slate-500 font-sans">
            Standard: ESA Space Debris Office (SDO) / NASA CARA Format
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-teal-700" />}
              <span>{copied ? 'Copied to Clipboard' : 'Copy Markdown'}</span>
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-200 text-slate-800 font-semibold text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-teal-700" />
              <span>Download .MD</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
