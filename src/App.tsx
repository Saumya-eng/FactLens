import { useState, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';

import {
  Upload,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  FileText,
  Activity,
  Cpu,
  Search,
  AlertTriangle,
} from 'lucide-react';

import { extractPdfText } from './lib/documentParser';

import {
  detectClaims,
  analyzeClaims,
} from './services/aiEngine';

import {
  VerificationResult,
  PipelineStep,
} from './models';

interface ChromePerformance extends Performance {
  memory?: {
    usedJSHeapSize: number;
  };
}

export default function App() {
  const [file, setFile] =
    useState<File | null>(null);

  const [extractedText, setExtractedText] =
    useState<string>('');

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [results, setResults] = useState<
    VerificationResult[]
  >([]);

  const [searchQuery, setSearchQuery] =
    useState('');

  const [error, setError] = useState<
    string | null
  >(null);

  const [steps, setSteps] = useState<
    PipelineStep[]
  >([
    {
      id: 'parse',
      label: 'PDF Parsing',
      status: 'idle',
    },
    {
      id: 'extract',
      label: 'Claim Extraction',
      status: 'idle',
    },
    {
      id: 'verify',
      label: 'Fact Verification',
      status: 'idle',
    },
  ]);

  const updateStep = (
    id: string,
    status: PipelineStep['status']
  ) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status }
          : s
      )
    );
  };

  const handleUpload = async (
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile =
      e.target.files?.[0];

    if (!selectedFile) return;

    processFile(selectedFile);
  };

  const processFile = async (
    file: File
  ) => {
    setFile(file);

    setIsProcessing(true);

    setResults([]);

    setError(null);

    setSteps((s) =>
      s.map((step) => ({
        ...step,
        status: 'idle',
      }))
    );

    try {
      updateStep('parse', 'loading');

      const text =
        await extractPdfText(file);

      setExtractedText(text);

      updateStep(
        'parse',
        'completed'
      );

      updateStep(
        'extract',
        'loading'
      );

      const claims =
        await detectClaims(text);

      updateStep(
        'extract',
        'completed'
      );

      updateStep(
        'verify',
        'loading'
      );

      await analyzeClaims(
        claims,
        (partialResults) => {
          setResults((prev) => {
            const existing =
              new Set(
                prev.map(
                  (r) => r.claim
                )
              );

            const filtered =
              partialResults.filter(
                (r) =>
                  !existing.has(
                    r.claim
                  )
              );

            return [
              ...prev,
              ...filtered,
            ];
          });
        }
      );

      updateStep(
        'verify',
        'completed'
      );
    } catch (err) {
      console.error(err);

      setError(
        'Something went wrong while processing the document.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredResults =
    results.filter((result) =>
      result.claim
        .toLowerCase()
        .includes(
          searchQuery.toLowerCase()
        )
    );

  const getStatusStyle = (
    status: VerificationResult['status']
  ) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-700 border-green-300';

      case 'inaccurate':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';

      case 'false':
        return 'bg-red-100 text-red-700 border-red-300';

      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-white overflow-hidden">
      {/* NAVBAR */}

      <nav className="h-16 border-b border-white/10 backdrop-blur-xl bg-white/5 flex items-center justify-between px-8">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-blue-500/20 border border-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>

          <div>
            <h1 className="font-bold text-xl tracking-tight">
              FactLens AI
            </h1>

            <p className="text-xs text-white/50">
              Smart Document Verification Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${
                isProcessing
                  ? 'bg-yellow-400 animate-pulse'
                  : 'bg-green-400'
              }`}
            />

            <span className="text-white/70">
              {isProcessing
                ? 'Processing'
                : 'System Active'}
            </span>
          </div>

          <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">
            FACTLENS ENGINE
          </div>
        </div>
      </nav>

      {/* MAIN */}

      <div className="grid lg:grid-cols-[380px_1fr] h-[calc(100vh-64px)]">
        {/* SIDEBAR */}

        <div className="border-r border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-y-auto">
          <div className="p-6">
            {/* Upload */}

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-3 mb-5">
                <FileText className="w-5 h-5 text-blue-400" />

                <h2 className="font-semibold">
                  Upload Document
                </h2>
              </div>

              {!file ? (
                <label className="border-2 border-dashed border-white/20 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400/50 transition-all">
                  <Upload className="w-12 h-12 text-white/40 mb-4" />

                  <p className="font-medium mb-1">
                    Upload PDF File
                  </p>

                  <p className="text-sm text-white/50 text-center">
                    Drag & drop or click to browse
                  </p>

                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf"
                    onChange={handleUpload}
                  />
                </label>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <p className="font-medium truncate">
                      {file.name}
                    </p>

                    <p className="text-sm text-white/50 mt-1">
                      {(file.size / 1024).toFixed(
                        1
                      )}{' '}
                      KB
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setFile(null)
                    }
                    className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition-all"
                  >
                    Clear File
                  </button>
                </div>
              )}
            </div>

            {/* STEPS */}

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-2 mb-5">
                <Cpu className="w-5 h-5 text-purple-400" />

                <h2 className="font-semibold">
                  Processing Pipeline
                </h2>
              </div>

              <div className="space-y-4">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between rounded-2xl bg-black/20 border border-white/5 px-4 py-3"
                  >
                    <span className="text-sm">
                      {step.label}
                    </span>

                    {step.status ===
                      'loading' && (
                      <RefreshCw className="w-4 h-4 animate-spin text-yellow-400" />
                    )}

                    {step.status ===
                      'completed' && (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* METRICS */}

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-green-400" />

                <h2 className="font-semibold">
                  Runtime Metrics
                </h2>
              </div>

              <div className="space-y-3 text-sm text-white/70">
                <div className="flex justify-between">
                  <span>Memory Usage</span>

                  <span>
                    {Math.round(
                      ((performance as ChromePerformance)
                        .memory
                        ?.usedJSHeapSize ||
                        0) /
                        1024 /
                        1024
                    )}
                    MB
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Results</span>

                  <span>
                    {results.length}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Status</span>

                  <span className="text-green-400">
                    Online
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT */}

        <div className="overflow-y-auto">
          <div className="p-8">
            {/* ERROR */}

            {error && (
              <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400" />

                <p className="text-red-200">
                  {error}
                </p>
              </div>
            )}

            {/* EMPTY STATE */}

            {results.length === 0 &&
              !isProcessing && (
                <div className="h-[70vh] flex flex-col items-center justify-center text-center">
                  <Search className="w-20 h-20 text-white/10 mb-6" />

                  <h2 className="text-3xl font-bold mb-3">
                    AI Fact Verification
                  </h2>

                  <p className="text-white/50 max-w-xl">
                    Upload a PDF document to
                    extract claims and verify
                    them using AI-powered
                    analysis and trusted web
                    references.
                  </p>
                </div>
              )}

            {/* SEARCH */}

            <div className="mb-6">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search claims..."
                  value={searchQuery}
                  onChange={(e) =>
                    setSearchQuery(
                      e.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl px-5 py-4 text-white placeholder:text-white/40 outline-none focus:border-blue-500/40"
                />

                <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              </div>
            </div>

            {/* RESULTS */}

            <AnimatePresence>
              <div className="grid gap-5">
                {filteredResults.map(
                  (result, idx) => (
                    <motion.div
                      key={`${result.claim}-${idx}`}
                      initial={{
                        opacity: 0,
                        y: 20,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{
                        opacity: 0,
                      }}
                      className="rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-6 hover:bg-white/[0.06] transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/20 flex items-center justify-center text-sm font-bold text-blue-300">
                              {idx + 1}
                            </div>

                            <span
                              className={`px-3 py-1 rounded-full border text-xs font-medium ${getStatusStyle(
                                result.status
                              )}`}
                            >
                              {result.status.toUpperCase()}
                            </span>
                          </div>

                          <h3 className="text-lg font-semibold leading-relaxed mb-4">
                            {result.claim}
                          </h3>

                          <p className="text-white/70 leading-relaxed">
                            {
                              result.explanation
                            }
                          </p>

                          <div className="mt-5 flex flex-wrap gap-2">
                            {result.sources
                              .slice(0, 5)
                              .map(
                                (
                                  source,
                                  sIdx
                                ) => (
                                  <a
                                    key={sIdx}
                                    href={
                                      source.url
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/30 border border-white/10 hover:bg-blue-500/20 hover:border-blue-500/30 transition-all text-sm"
                                  >
                                    Source{' '}
                                    {sIdx + 1}

                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )
                              )}
                          </div>
                        </div>

                        <div className="min-w-[120px]">
                          <div className="rounded-2xl bg-black/30 border border-white/10 p-4 text-center">
                            <p className="text-sm text-white/50 mb-2">
                              Confidence
                            </p>

                            <p className="text-3xl font-bold">
                              {(
                                result.confidence *
                                100
                              ).toFixed(0)}
                              %
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                )}
              </div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}