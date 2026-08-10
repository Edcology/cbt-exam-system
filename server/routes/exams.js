const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { get, run, all } = require('../db');
const { authenticateAdminToken } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// List all exams
router.get('/', authenticateAdminToken, async (req, res) => {
  try {
    const exams = await all(`
      SELECT e.*,
        (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) as question_count,
        (SELECT COUNT(*) FROM custom_fields c WHERE c.exam_id = e.id) as field_count,
        (SELECT COUNT(*) FROM exam_sessions s WHERE s.exam_id = e.id) as session_count
      FROM exams e
      ORDER BY e.created_at DESC
    `);
    res.json(exams);
  } catch (err) {
    console.error('List exams error:', err);
    res.status(500).json({ error: 'Failed to fetch exams' });
  }
});

// Download Excel Template for Questions
router.get('/excel-template', (req, res) => {
  try {
    const sampleData = [
      {
        question_text: "What does HTML stand for?",
        type: "single_choice", // single_choice, multiple_choice, true_false
        option_a: "Hyper Text Markup Language",
        option_b: "High Text Machine Language",
        option_c: "Hyper Transfer Mode Line",
        option_d: "Home Tool Markup Language",
        correct_answers: "A", // For single choice: A, B, C or D. For multiple choice: A,C
        marks: 2,
        explanation: "HTML stands for Hyper Text Markup Language."
      },
      {
        question_text: "JavaScript is a compiled programming language.",
        type: "true_false",
        option_a: "True",
        option_b: "False",
        option_c: "",
        option_d: "",
        correct_answers: "B",
        marks: 1,
        explanation: "JavaScript is primarily an interpreted/JIT-compiled scripting language."
      },
      {
        question_text: "Which of the following are CSS layout frameworks?",
        type: "multiple_choice",
        option_a: "Tailwind CSS",
        option_b: "Bootstrap",
        option_c: "Node.js",
        option_d: "Bulma",
        correct_answers: "A,B,D",
        marks: 3,
        explanation: "Tailwind, Bootstrap, and Bulma are CSS frameworks. Node.js is a runtime."
      }
    ];

    const worksheet = xlsx.utils.json_to_sheet(sampleData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Questions_Template");

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=CBT_Questions_Template.xlsx');
    res.send(buffer);
  } catch (err) {
    console.error('Template generator error:', err);
    res.status(500).json({ error: 'Failed to generate Excel template' });
  }
});

// Get single exam details
router.get('/:id', authenticateAdminToken, async (req, res) => {
  try {
    const exam = await get('SELECT * FROM exams WHERE id = ?', [req.params.id]);
    if (!exam) {
      return res.status(404).json({ error: 'Exam not found' });
    }

    const customFields = await all('SELECT * FROM custom_fields WHERE exam_id = ?', [req.params.id]);
    const questions = await all('SELECT * FROM questions WHERE exam_id = ?', [req.params.id]);

    const parsedCustomFields = customFields.map(f => ({
      ...f,
      options: f.options ? JSON.parse(f.options) : []
    }));

    const parsedQuestions = questions.map(q => ({
      ...q,
      options: JSON.parse(q.options),
      correct_answers: JSON.parse(q.correct_answers)
    }));

    res.json({
      ...exam,
      custom_fields: parsedCustomFields,
      questions: parsedQuestions
    });
  } catch (err) {
    console.error('Get exam error:', err);
    res.status(500).json({ error: 'Failed to fetch exam details' });
  }
});

// Create new exam with custom registration fields
router.post('/', authenticateAdminToken, async (req, res) => {
  try {
    const {
      title,
      description,
      duration_minutes,
      passing_score,
      shuffle_questions,
      show_results_immediately,
      custom_fields // array of { field_name, field_type, options, is_required }
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Exam title is required' });
    }

    const result = await run(`
      INSERT INTO exams (title, description, duration_minutes, passing_score, shuffle_questions, show_results_immediately)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      title.trim(),
      description || '',
      duration_minutes || 30,
      passing_score || 50,
      shuffle_questions !== undefined ? (shuffle_questions ? 1 : 0) : 1,
      show_results_immediately !== undefined ? (show_results_immediately ? 1 : 0) : 1
    ]);

    const examId = result.lastID;

    // Add default custom field if none provided (Full Name)
    const fieldsToInsert = (custom_fields && custom_fields.length > 0) ? custom_fields : [
      { field_name: 'Full Name', field_type: 'text', is_required: 1 },
      { field_name: 'Student / Reg Number', field_type: 'text', is_required: 1 }
    ];

    for (const f of fieldsToInsert) {
      await run(`
        INSERT INTO custom_fields (exam_id, field_name, field_type, options, is_required)
        VALUES (?, ?, ?, ?, ?)
      `, [
        examId,
        f.field_name,
        f.field_type || 'text',
        f.options ? JSON.stringify(f.options) : null,
        f.is_required !== undefined ? (f.is_required ? 1 : 0) : 1
      ]);
    }

    res.status(201).json({ message: 'Exam created successfully', id: examId });
  } catch (err) {
    console.error('Create exam error:', err);
    res.status(500).json({ error: 'Failed to create exam' });
  }
});

// Update exam & custom fields
router.put('/:id', authenticateAdminToken, async (req, res) => {
  try {
    const {
      title,
      description,
      duration_minutes,
      passing_score,
      shuffle_questions,
      show_results_immediately,
      custom_fields
    } = req.body;

    const examId = req.params.id;

    await run(`
      UPDATE exams SET
        title = ?,
        description = ?,
        duration_minutes = ?,
        passing_score = ?,
        shuffle_questions = ?,
        show_results_immediately = ?
      WHERE id = ?
    `, [
      title,
      description,
      duration_minutes,
      passing_score,
      shuffle_questions ? 1 : 0,
      show_results_immediately ? 1 : 0,
      examId
    ]);

    if (custom_fields && Array.isArray(custom_fields)) {
      await run('DELETE FROM custom_fields WHERE exam_id = ?', [examId]);
      for (const f of custom_fields) {
        await run(`
          INSERT INTO custom_fields (exam_id, field_name, field_type, options, is_required)
          VALUES (?, ?, ?, ?, ?)
        `, [
          examId,
          f.field_name,
          f.field_type || 'text',
          f.options ? JSON.stringify(f.options) : null,
          f.is_required ? 1 : 0
        ]);
      }
    }

    res.json({ message: 'Exam updated successfully' });
  } catch (err) {
    console.error('Update exam error:', err);
    res.status(500).json({ error: 'Failed to update exam' });
  }
});

// Delete Exam
router.delete('/:id', authenticateAdminToken, async (req, res) => {
  try {
    await run('DELETE FROM exams WHERE id = ?', [req.params.id]);
    res.json({ message: 'Exam deleted successfully' });
  } catch (err) {
    console.error('Delete exam error:', err);
    res.status(500).json({ error: 'Failed to delete exam' });
  }
});

// Add Single Question
router.post('/:id/questions', authenticateAdminToken, async (req, res) => {
  try {
    const examId = req.params.id;
    const { question_text, type, options, correct_answers, marks, explanation } = req.body;

    if (!question_text || !options || !correct_answers) {
      return res.status(400).json({ error: 'Question text, options, and correct answers are required' });
    }

    const result = await run(`
      INSERT INTO questions (exam_id, question_text, type, options, correct_answers, marks, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      examId,
      question_text.trim(),
      type || 'single_choice',
      JSON.stringify(options),
      JSON.stringify(correct_answers),
      marks || 1,
      explanation || ''
    ]);

    res.status(201).json({ message: 'Question added successfully', id: result.lastID });
  } catch (err) {
    console.error('Add question error:', err);
    res.status(500).json({ error: 'Failed to add question' });
  }
});

// Edit Question
router.put('/:id/questions/:qId', authenticateAdminToken, async (req, res) => {
  try {
    const { qId } = req.params;
    const { question_text, type, options, correct_answers, marks, explanation } = req.body;

    await run(`
      UPDATE questions SET
        question_text = ?,
        type = ?,
        options = ?,
        correct_answers = ?,
        marks = ?,
        explanation = ?
      WHERE id = ? AND exam_id = ?
    `, [
      question_text.trim(),
      type || 'single_choice',
      JSON.stringify(options),
      JSON.stringify(correct_answers),
      marks || 1,
      explanation || '',
      qId,
      req.params.id
    ]);

    res.json({ message: 'Question updated successfully' });
  } catch (err) {
    console.error('Edit question error:', err);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// Delete Question
router.delete('/:id/questions/:qId', authenticateAdminToken, async (req, res) => {
  try {
    await run('DELETE FROM questions WHERE id = ? AND exam_id = ?', [req.params.qId, req.params.id]);
    res.json({ message: 'Question deleted successfully' });
  } catch (err) {
    console.error('Delete question error:', err);
    res.status(500).json({ error: 'Failed to delete question' });
  }
});

// Bulk Import Questions from Excel Spreadsheet (.xlsx / .xls / .csv)
router.post('/:id/import-excel', authenticateAdminToken, upload.single('file'), async (req, res) => {
  try {
    const examId = req.params.id;
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'The uploaded file is empty' });
    }

    let importedCount = 0;

    for (const row of rows) {
      const qText = row.question_text || row.Question || row.question;
      if (!qText) continue;

      const qType = (row.type || row.Type || 'single_choice').toLowerCase().replace('-', '_').trim();
      const markVal = parseInt(row.marks || row.Marks || 1);
      const explanationText = row.explanation || row.Explanation || '';

      const optA = row.option_a || row['Option A'] || row.A || '';
      const optB = row.option_b || row['Option B'] || row.B || '';
      const optC = row.option_c || row['Option C'] || row.C || '';
      const optD = row.option_d || row['Option D'] || row.D || '';

      const options = [optA, optB, optC, optD].filter(o => o.toString().trim() !== '');

      const correctRaw = (row.correct_answers || row.Correct || row.Answer || 'A').toString().trim();
      let correctAnswers = [];

      if (qType === 'true_false') {
        const lower = correctRaw.toLowerCase();
        correctAnswers = [lower.startsWith('t') || lower === 'a' ? 'True' : 'False'];
      } else {
        // Map A, B, C, D to exact option values or direct text
        const letters = correctRaw.split(',').map(s => s.trim().toUpperCase());
        for (const l of letters) {
          if (l === 'A' && optA) correctAnswers.push(optA.toString());
          else if (l === 'B' && optB) correctAnswers.push(optB.toString());
          else if (l === 'C' && optC) correctAnswers.push(optC.toString());
          else if (l === 'D' && optD) correctAnswers.push(optD.toString());
          else if (options.includes(correctRaw)) correctAnswers.push(correctRaw);
        }
        if (correctAnswers.length === 0 && options.length > 0) {
          correctAnswers = [options[0]]; // fallback default
        }
      }

      await run(`
        INSERT INTO questions (exam_id, question_text, type, options, correct_answers, marks, explanation)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        examId,
        qText.toString().trim(),
        qType,
        JSON.stringify(options),
        JSON.stringify(correctAnswers),
        markVal,
        explanationText.toString()
      ]);

      importedCount++;
    }

    res.json({ message: `Successfully imported ${importedCount} questions from Excel!`, count: importedCount });
  } catch (err) {
    console.error('Excel import error:', err);
    res.status(500).json({ error: 'Failed to parse and import Excel file. Please check format.' });
  }
});

module.exports = router;
