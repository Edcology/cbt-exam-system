import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, Upload, Download, Save, CheckCircle2, HelpCircle, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { apiRequest } from '../api';

export default function AdminExamManager({ token, onBack }) {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeExam, setActiveExam] = useState(null); // null = list mode, object = edit mode
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Exam Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [passingScore, setPassingScore] = useState(50);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [showResultsImmediately, setShowResultsImmediately] = useState(true);

  // Custom Registration Fields State
  const [customFields, setCustomFields] = useState([
    { field_name: 'Full Name', field_type: 'text', is_required: true, options: [] },
    { field_name: 'Student Reg Number', field_type: 'text', is_required: true, options: [] }
  ]);

  // Questions State
  const [questions, setQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [qText, setQText] = useState('');
  const [qType, setQType] = useState('single_choice');
  const [qMarks, setQMarks] = useState(1);
  const [qExplanation, setQExplanation] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrect, setQCorrect] = useState(['A']);

  // Excel Upload State
  const [excelFile, setExcelFile] = useState(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const data = await apiRequest('/exams', 'GET', null, token);
      setExams(data);
    } catch (err) {
      setError('Failed to fetch exams list');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setActiveExam({ isNew: true });
    setTitle('');
    setDescription('');
    setDurationMinutes(30);
    setPassingScore(50);
    setShuffleQuestions(true);
    setShowResultsImmediately(true);
    setCustomFields([
      { field_name: 'Full Name', field_type: 'text', is_required: true, options: [] },
      { field_name: 'Student Reg Number', field_type: 'text', is_required: true, options: [] }
    ]);
    setQuestions([]);
    setError('');
    setSuccess('');
  };

  const handleEditExam = async (examId) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const details = await apiRequest(`/exams/${examId}`, 'GET', null, token);
      setActiveExam(details);
      setTitle(details.title);
      setDescription(details.description || '');
      setDurationMinutes(details.duration_minutes);
      setPassingScore(details.passing_score);
      setShuffleQuestions(details.shuffle_questions === 1);
      setShowResultsImmediately(details.show_results_immediately === 1);
      setCustomFields(details.custom_fields || []);
      setQuestions(details.questions || []);
    } catch (err) {
      setError('Failed to load exam details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveExamSettings = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const payload = {
      title,
      description,
      duration_minutes: durationMinutes,
      passing_score: passingScore,
      shuffle_questions: shuffleQuestions,
      show_results_immediately: showResultsImmediately,
      custom_fields: customFields
    };

    try {
      if (activeExam?.isNew) {
        const res = await apiRequest('/exams', 'POST', payload, token);
        setSuccess('Exam created successfully!');
        handleEditExam(res.id);
      } else {
        await apiRequest(`/exams/${activeExam.id}`, 'PUT', payload, token);
        setSuccess('Exam settings updated successfully!');
      }
      fetchExams();
    } catch (err) {
      setError(err.message || 'Failed to save exam');
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam and all its questions?')) return;
    try {
      await apiRequest(`/exams/${examId}`, 'DELETE', null, token);
      setSuccess('Exam deleted');
      setActiveExam(null);
      fetchExams();
    } catch (err) {
      setError('Failed to delete exam');
    }
  };

  // Custom Field Handlers
  const addCustomField = () => {
    setCustomFields(prev => [...prev, { field_name: '', field_type: 'text', is_required: true, options: [] }]);
  };

  const removeCustomField = (index) => {
    setCustomFields(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateCustomField = (index, key, value) => {
    setCustomFields(prev => {
      const updated = [...prev];
      updated[index][key] = value;
      return updated;
    });
  };

  // Question Management Handlers
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!qText.trim() || !qOptA || !qOptB) {
      setError('Question text and at least options A & B are required');
      return;
    }

    const options = [qOptA, qOptB, qOptC, qOptD].filter(o => o.trim() !== '');

    // Map correct letters A, B, C, D to actual text values
    let correctAnswers = [];
    if (qType === 'true_false') {
      correctAnswers = [qCorrect[0] === 'A' ? 'True' : 'False'];
    } else {
      correctAnswers = qCorrect.map(letter => {
        if (letter === 'A') return qOptA;
        if (letter === 'B') return qOptB;
        if (letter === 'C') return qOptC;
        if (letter === 'D') return qOptD;
        return letter;
      }).filter(Boolean);
    }

    const payload = {
      question_text: qText,
      type: qType,
      options,
      correct_answers: correctAnswers,
      marks: parseInt(qMarks),
      explanation: qExplanation
    };

    try {
      if (editingQuestion) {
        await apiRequest(`/exams/${activeExam.id}/questions/${editingQuestion.id}`, 'PUT', payload, token);
        setSuccess('Question updated');
      } else {
        await apiRequest(`/exams/${activeExam.id}/questions`, 'POST', payload, token);
        setSuccess('Question added');
      }
      resetQuestionForm();
      handleEditExam(activeExam.id);
    } catch (err) {
      setError('Failed to save question');
    }
  };

  const resetQuestionForm = () => {
    setEditingQuestion(null);
    setQText('');
    setQType('single_choice');
    setQMarks(1);
    setQExplanation('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQCorrect(['A']);
  };

  const handleDeleteQuestion = async (qId) => {
    try {
      await apiRequest(`/exams/${activeExam.id}/questions/${qId}`, 'DELETE', null, token);
      handleEditExam(activeExam.id);
    } catch (err) {
      setError('Failed to delete question');
    }
  };

  // Excel Spreadsheet Import Handler
  const handleExcelImport = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      setError('Please select an Excel file (.xlsx / .csv)');
      return;
    }

    setUploadingExcel(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const res = await apiRequest(`/exams/${activeExam.id}/import-excel`, 'POST', formData, token);
      setSuccess(res.message);
      setExcelFile(null);
      handleEditExam(activeExam.id);
    } catch (err) {
      setError(err.message || 'Excel import failed. Please verify format.');
    } finally {
      setUploadingExcel(false);
    }
  };

  const downloadExcelTemplate = () => {
    window.open('/api/exams/excel-template', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          {activeExam && (
            <button
              onClick={() => setActiveExam(null)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">
              {activeExam ? (activeExam.isNew ? 'Create New Exam' : `Edit Exam: ${activeExam.title}`) : 'Exam Management Bank'}
            </h1>
            <p className="text-xs text-slate-400">Configure questions, dynamic candidate fields, and Excel templates</p>
          </div>
        </div>

        {!activeExam && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-lg transition"
          >
            <Plus className="w-4 h-4" /> Add New Exam
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-500/50 rounded-xl text-rose-300 text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs">
          {success}
        </div>
      )}

      {/* Mode 1: Exam List Table */}
      {!activeExam ? (
        <div className="glass-panel p-6 rounded-2xl">
          {exams.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exams.map((exam) => (
                <div key={exam.id} className="glass-card p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-white text-base leading-snug">{exam.title}</h3>
                      <span className="text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-700 px-2 py-0.5 rounded">
                        {exam.duration_minutes} Mins
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs line-clamp-2 mb-4">
                      {exam.description || 'No description provided.'}
                    </p>

                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 mb-4 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                      <div>
                        <span className="block text-slate-500 font-semibold">Questions</span>
                        <span className="font-bold text-indigo-400">{exam.question_count} Items</span>
                      </div>
                      <div>
                        <span className="block text-slate-500 font-semibold">Fields</span>
                        <span className="font-bold text-emerald-400">{exam.field_count} Custom</span>
                      </div>
                      <div>
                        <span className="block text-slate-500 font-semibold">Pass %</span>
                        <span className="font-bold text-white">{exam.passing_score}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => handleEditExam(exam.id)}
                      className="flex-1 bg-indigo-600/30 hover:bg-indigo-600/70 border border-indigo-500/40 text-indigo-200 text-xs font-semibold py-2 rounded-xl transition flex items-center justify-center gap-1"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit Exam
                    </button>
                    <button
                      onClick={() => handleDeleteExam(exam.id)}
                      className="bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 p-2 rounded-xl transition"
                      title="Delete Exam"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs">
              No exams found. Click "Add New Exam" to build your first assessment.
            </div>
          )}
        </div>
      ) : (
        /* Mode 2: Exam Editor (Settings + Custom Fields + Questions + Excel Import) */
        <div className="space-y-6">
          {/* Section 1: General Exam Settings & Custom Candidate Fields */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">1. General Exam Settings & Student Fields</h3>

            <form onSubmit={handleSaveExamSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Exam Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. GST101 General Studies Final Exam"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500"
                    min={1}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description / Instructions</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Instructions shown to candidates before starting the test"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500 h-20"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Passing Mark %</label>
                  <input
                    type="number"
                    value={passingScore}
                    onChange={(e) => setPassingScore(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                    min={1}
                    max={100}
                  />
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="shuffleCheck"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                  <label htmlFor="shuffleCheck" className="text-xs text-slate-300 cursor-pointer">
                    Shuffle Questions for examinees
                  </label>
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="resultsCheck"
                    checked={showResultsImmediately}
                    onChange={(e) => setShowResultsImmediately(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                  <label htmlFor="resultsCheck" className="text-xs text-slate-300 cursor-pointer">
                    Show results immediately upon submit
                  </label>
                </div>
              </div>

              {/* Dynamic Registration Fields */}
              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Configured Student Registration Entry Fields
                  </h4>
                  <button
                    type="button"
                    onClick={addCustomField}
                    className="text-xs bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600/60 px-2.5 py-1 rounded-lg border border-indigo-500/40 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3 h-3" /> Add Registration Field
                  </button>
                </div>

                <div className="space-y-2">
                  {customFields.map((field, idx) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 text-xs">
                      <input
                        type="text"
                        value={field.field_name}
                        onChange={(e) => updateCustomField(idx, 'field_name', e.target.value)}
                        placeholder="Field Title (e.g. Department)"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                        required
                      />
                      <select
                        value={field.field_type}
                        onChange={(e) => updateCustomField(idx, 'field_type', e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
                      >
                        <option value="text">Text Input</option>
                        <option value="number">Number Input</option>
                      </select>
                      <label className="flex items-center gap-1 text-slate-300 px-2">
                        <input
                          type="checkbox"
                          checked={field.is_required}
                          onChange={(e) => updateCustomField(idx, 'is_required', e.target.checked)}
                          className="accent-indigo-600"
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        onClick={() => removeCustomField(idx)}
                        className="text-rose-400 hover:text-rose-300 p-1"
                        disabled={customFields.length <= 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-lg transition flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Save Exam Settings & Fields
                </button>
              </div>
            </form>
          </div>

          {/* Section 2: Question Bank & Excel Bulk Upload (Only if exam exists) */}
          {!activeExam.isNew && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Question Editor & Bulk Upload (2 Cols) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Excel Bulk Upload Card */}
                <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-emerald-500">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                      Bulk Import Questions via Excel Spreadsheet
                    </h3>
                    <button
                      onClick={downloadExcelTemplate}
                      className="text-xs text-emerald-300 hover:text-white bg-emerald-950/60 border border-emerald-700/60 px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5" /> Sample Template (.xlsx)
                    </button>
                  </div>

                  <p className="text-slate-400 text-xs mb-4">
                    Upload an Excel file (.xlsx or .csv) matching our sample template columns: <code className="bg-slate-900 px-1 py-0.5 rounded text-indigo-300">question_text, type, option_a, option_b, option_c, option_d, correct_answers, marks</code>
                  </p>

                  <form onSubmit={handleExcelImport} className="flex items-center gap-3">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) => setExcelFile(e.target.files[0])}
                      className="text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                    />
                    <button
                      type="submit"
                      disabled={uploadingExcel || !excelFile}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs py-2 px-4 rounded-xl shadow transition flex items-center gap-1.5 shrink-0"
                    >
                      <Upload className="w-4 h-4" /> {uploadingExcel ? 'Importing...' : 'Upload & Process'}
                    </button>
                  </form>
                </div>

                {/* Manual Question Form */}
                <div className="glass-panel p-6 rounded-2xl">
                  <h3 className="text-base font-bold text-white mb-4">
                    {editingQuestion ? 'Edit Question' : 'Add Single Question'}
                  </h3>

                  <form onSubmit={handleSaveQuestion} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Question Text</label>
                      <textarea
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        placeholder="Enter question text..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white outline-none focus:border-indigo-500 h-20"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Question Type</label>
                        <select
                          value={qType}
                          onChange={(e) => setQType(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                        >
                          <option value="single_choice">Single Choice (Radio)</option>
                          <option value="multiple_choice">Multiple Choice (Select All)</option>
                          <option value="true_false">True / False</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Marks</label>
                        <input
                          type="number"
                          value={qMarks}
                          onChange={(e) => setQMarks(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none"
                          min={1}
                          required
                        />
                      </div>
                    </div>

                    {/* Options Inputs */}
                    {qType !== 'true_false' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-indigo-300 mb-1">Option A</label>
                          <input
                            type="text"
                            value={qOptA}
                            onChange={(e) => setQOptA(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-indigo-300 mb-1">Option B</label>
                          <input
                            type="text"
                            value={qOptB}
                            onChange={(e) => setQOptB(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-indigo-300 mb-1">Option C</label>
                          <input
                            type="text"
                            value={qOptC}
                            onChange={(e) => setQOptC(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-indigo-300 mb-1">Option D</label>
                          <input
                            type="text"
                            value={qOptD}
                            onChange={(e) => setQOptD(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 p-2 bg-slate-900 rounded-lg">
                        Options will be automatically set to: <strong className="text-white">True</strong> and <strong className="text-white">False</strong>
                      </div>
                    )}

                    {/* Correct Key Picker */}
                    <div className="pt-2">
                      <label className="block text-xs font-semibold text-emerald-400 mb-1">Select Correct Answer Key</label>
                      <div className="flex gap-2">
                        {['A', 'B', 'C', 'D'].map((letter) => (
                          <button
                            key={letter}
                            type="button"
                            onClick={() => {
                              if (qType === 'multiple_choice') {
                                setQCorrect(prev => prev.includes(letter) ? prev.filter(l => l !== letter) : [...prev, letter]);
                              } else {
                                setQCorrect([letter]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                              qCorrect.includes(letter)
                                ? 'bg-emerald-600 text-white border-emerald-400'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                          >
                            Option {letter}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Explanation (Optional)</label>
                      <input
                        type="text"
                        value={qExplanation}
                        onChange={(e) => setQExplanation(e.target.value)}
                        placeholder="Explanation shown to students in review"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow transition"
                      >
                        {editingQuestion ? 'Update Question' : 'Save Question to Bank'}
                      </button>
                      {editingQuestion && (
                        <button
                          type="button"
                          onClick={resetQuestionForm}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold py-2.5 px-4 rounded-xl transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>

              {/* Questions List Sidebar (1 Col) */}
              <div className="glass-panel p-6 rounded-2xl max-h-[800px] overflow-y-auto">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                  <h3 className="font-bold text-white text-sm">Question Bank ({questions.length})</h3>
                </div>

                {questions.length > 0 ? (
                  <div className="space-y-3">
                    {questions.map((q, idx) => (
                      <div key={q.id} className="glass-card p-3 rounded-xl border border-slate-800 text-xs">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-bold text-indigo-300">Q{idx + 1}.</span>
                          <span className="bg-indigo-950 text-indigo-300 text-[10px] px-1.5 py-0.5 rounded font-mono">
                            {q.marks} Mark
                          </span>
                        </div>
                        <p className="text-slate-200 font-medium mb-2">{q.question_text}</p>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                          <span className="text-[10px] text-emerald-400 font-semibold truncate max-w-[150px]">
                            Key: {Array.isArray(q.correct_answers) ? q.correct_answers.join(', ') : q.correct_answers}
                          </span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditingQuestion(q);
                                setQText(q.question_text);
                                setQType(q.type);
                                setQMarks(q.marks);
                                setQExplanation(q.explanation || '');
                                setQOptA(q.options[0] || '');
                                setQOptB(q.options[1] || '');
                                setQOptC(q.options[2] || '');
                                setQOptD(q.options[3] || '');
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-400"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(q.id)}
                              className="p-1 text-slate-400 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 text-xs">
                    No questions added yet. Use the Excel bulk import or manual builder.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
