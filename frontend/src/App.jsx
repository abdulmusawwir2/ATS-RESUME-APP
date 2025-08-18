import { useState } from "react";

function App() {
  const [jobDesc, setJobDesc] = useState("");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_URL = "http://localhost:8000";

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];

    if (selectedFile) {
      // Validate file type
      if (selectedFile.type !== 'application/pdf') {
        setError("Please select a PDF file only.");
        setFile(null);
        return;
      }

      // Validate file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (selectedFile.size > maxSize) {
        setError("File size must be less than 10MB.");
        setFile(null);
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    // Reset states
    setError(null);
    setResult(null);

    // Validation
    if (!jobDesc.trim()) {
      setError("Please provide a job description.");
      return;
    }

    if (!file) {
      setError("Please upload a PDF resume file.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("job_description", jobDesc.trim());
      formData.append("file", file);

      console.log("Sending request to:", `${API_URL}/evaluate`);

      const response = await fetch(`${API_URL}/evaluate`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();   

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      if (data.error) {
        setError(data.error);
        setResult(null);
      } else if (data.result) {
        setResult(data.result);
        setError(null);
      } else {
        setError("Invalid response from server. Please try again.");
      }

    } catch (err) {
      console.error("Request failed:", err);

      // Handle different error types with more specific messages
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        setError("❌ Cannot connect to server. Please check:\n• Backend is running on port 8000\n• No firewall blocking the connection\n• Server started without errors");
      } else if (err.message.includes('timeout')) {
        setError("⏱️ Request timed out. This might be due to:\n• Large PDF file\n• Server overload\n• Network issues\n\nTry with a smaller PDF or wait and retry.");
      } else if (err.message.includes('PDF') || err.message.includes('GraphicsMagick')) {
        setError("📄 PDF processing failed. Please ensure:\n• PDF is not corrupted\n• PDF is not password protected\n• File size is under 10MB\n• GraphicsMagick is installed on server");
      } else if (err.message.includes('API key') || err.message.includes('quota')) {
        setError("🔑 AI service error. Please contact administrator:\n• API key may be invalid\n• Rate limit exceeded\n• Service temporarily unavailable");
      } else {
        setError(err.message || "❌ An unexpected error occurred. Please try again or contact support if the issue persists.");
      }

      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResult(null);
    setError(null);
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getScoreText = (score) => {
    if (score >= 80) return "Excellent Match";
    if (score >= 60) return "Good Match";
    if (score >= 40) return "Fair Match";
    return "Poor Match";
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              <span className="text-blue-600">ResumeFit</span> - an ATS Resume Evaluator
            </h1>
            <p className="text-gray-600">
              Get AI-powered feedback on how well your resume matches job requirements
            </p>
          </div>

          <div className="space-y-6">
            {/* Job Description Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Description *
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-md p-3 h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Paste the job description here..."
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                disabled={loading}
              />
              <p className="text-sm text-gray-500 mt-1">
                Characters: {jobDesc.length}
              </p>
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Resume (PDF only) *
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              {file && (
                <div className="mt-2 text-sm text-green-600">
                  ✓ Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                </div>
              )}
              <p className="text-sm text-gray-500 mt-1">
                Maximum file size: 10MB. Only PDF files are supported.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleSubmit}
                disabled={loading || !jobDesc.trim() || !file}
                className={`flex-1 px-6 py-3 rounded-md font-medium transition-colors ${loading || !jobDesc.trim() || !file
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing Resume...
                  </span>
                ) : (
                  "Evaluate Resume"
                )}
              </button>

              {(result || error) && (
                <button
                  onClick={clearResults}
                  disabled={loading}
                  className="px-6 py-3 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Clear Results
                </button>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Error
                  </h3>
                  <div className="mt-1 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results Display */}
          {result && (
            <div className="mt-8 space-y-6">
              <div className="border-t border-gray-200 pt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  Evaluation Results
                </h2>

                {/* Match Score */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Overall Match Score
                    </h3>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {result.match_score}%
                      </div>
                      <div className={`text-sm font-medium ${result.match_score >= 80 ? "text-green-600" :
                        result.match_score >= 60 ? "text-yellow-600" : "text-red-600"
                        }`}>
                        {getScoreText(result.match_score)}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className={`h-4 rounded-full transition-all duration-500 ${getScoreColor(result.match_score)}`}
                      style={{ width: `${result.match_score}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Strengths */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Strengths ({result.strengths?.length || 0})
                    </h3>
                    {result.strengths?.length > 0 ? (
                      <ul className="space-y-2">
                        {result.strengths.map((strength, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-green-600 mr-2">•</span>
                            <span className="text-green-800">{strength}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-green-700">No specific strengths identified.</p>
                    )}
                  </div>

                  {/* Missing Keywords */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Missing Keywords ({result.missing_keywords?.length || 0})
                    </h3>
                    {result.missing_keywords?.length > 0 ? (
                      <ul className="space-y-2">
                        {result.missing_keywords.map((keyword, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-yellow-600 mr-2">•</span>
                            <span className="text-yellow-800">{keyword}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-yellow-700">All important keywords are present.</p>
                    )}
                  </div>
                </div>

                {/* Weaknesses */}
                {result.weaknesses?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 mt-6">
                    <h3 className="text-lg font-semibold text-red-800 mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Areas for Improvement ({result.weaknesses.length})
                    </h3>
                    <ul className="space-y-2">
                      {result.weaknesses.map((weakness, idx) => (
                        <li key={idx} className="flex items-start">
                          <span className="text-red-600 mr-2">•</span>
                          <span className="text-red-800">{weakness}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;