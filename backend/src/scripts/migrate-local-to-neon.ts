import { pool, ensureNeonSchema } from "../db/neon.js";
import { getLocalSnapshot } from "../db/local-app-store.js";

const run = async () => {
  if (!pool) {
    throw new Error("Neon is not configured. Please set NEON_DATABASE_URL first.");
  }

  await ensureNeonSchema();
  const local = getLocalSnapshot();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const row of local.user_accounts) {
      await client.query(
        `
        INSERT INTO user_accounts (id, email, password_hash, name, created_at)
        VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()))
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          name = EXCLUDED.name
        `,
        [row.id, row.email, row.password_hash, row.name, row.created_at ?? null],
      );
    }

    for (const row of local.profiles) {
      await client.query(
        `
        INSERT INTO profiles (
          id, name, target_year, optional_subject, study_hours_per_day, language,
          profile_photo_url, mentor_personality, current_streak, total_xp, level,
          created_at, updated_at, last_login_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          COALESCE($12::timestamptz, NOW()),
          COALESCE($13::timestamptz, NOW()),
          $14::date
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          target_year = EXCLUDED.target_year,
          optional_subject = EXCLUDED.optional_subject,
          study_hours_per_day = EXCLUDED.study_hours_per_day,
          language = EXCLUDED.language,
          profile_photo_url = EXCLUDED.profile_photo_url,
          mentor_personality = EXCLUDED.mentor_personality,
          current_streak = EXCLUDED.current_streak,
          total_xp = EXCLUDED.total_xp,
          level = EXCLUDED.level,
          updated_at = NOW(),
          last_login_date = EXCLUDED.last_login_date
        `,
        [
          row.id,
          row.name,
          row.target_year ?? null,
          row.optional_subject ?? null,
          row.study_hours_per_day ?? null,
          row.language ?? "English",
          row.profile_photo_url ?? null,
          row.mentor_personality ?? "friendly",
          row.current_streak ?? 0,
          row.total_xp ?? 0,
          row.level ?? 1,
          row.created_at ?? null,
          row.updated_at ?? null,
          row.last_login_date ?? null,
        ],
      );
    }

    for (const row of local.auth_sessions) {
      await client.query(
        `
        INSERT INTO auth_sessions (token, refresh_token, user_id, created_at, expires_at)
        VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5::timestamptz)
        ON CONFLICT (token) DO UPDATE SET
          refresh_token = EXCLUDED.refresh_token,
          user_id = EXCLUDED.user_id,
          expires_at = EXCLUDED.expires_at
        `,
        [
          row.token,
          row.refresh_token ?? "",
          row.user_id,
          row.created_at ?? null,
          row.expires_at ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
        ],
      );
    }

    for (const row of local.chat_messages) {
      await client.query(
        `
        INSERT INTO chat_messages (id, user_id, chat_type, role, message, content, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
        ON CONFLICT (id) DO UPDATE SET
          chat_type = EXCLUDED.chat_type,
          role = EXCLUDED.role,
          message = EXCLUDED.message,
          content = EXCLUDED.content
        `,
        [
          row.id,
          row.user_id,
          row.chat_type ?? "mentor",
          row.role ?? "assistant",
          row.message ?? row.content ?? "",
          row.content ?? row.message ?? "",
          row.created_at ?? null,
        ],
      );
    }

    for (const row of local.prelims_attempts) {
      await client.query(
        `
        INSERT INTO prelims_attempts (
          id, user_id, question_id, selected_answer, is_correct, subject, level, score, total_questions, attempted_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, NOW())
        )
        ON CONFLICT (id) DO UPDATE SET
          selected_answer = EXCLUDED.selected_answer,
          is_correct = EXCLUDED.is_correct,
          subject = EXCLUDED.subject,
          level = EXCLUDED.level,
          score = EXCLUDED.score,
          total_questions = EXCLUDED.total_questions
        `,
        [
          row.id,
          row.user_id,
          row.question_id ?? null,
          row.selected_answer ?? null,
          row.is_correct ?? null,
          row.subject ?? null,
          row.level ?? null,
          row.score ?? null,
          row.total_questions ?? null,
          row.attempted_at ?? null,
        ],
      );
    }

    for (const row of local.mains_submissions) {
      await client.query(
        `
        INSERT INTO mains_submissions (
          id, user_id, question_id, question_text, answer_text, answer_image_url, word_count,
          evaluation, marks, ai_score, ai_feedback, section, submitted_at, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, COALESCE($13::timestamptz, NOW()), COALESCE($14::timestamptz, NOW())
        )
        ON CONFLICT (id) DO UPDATE SET
          answer_text = EXCLUDED.answer_text,
          answer_image_url = EXCLUDED.answer_image_url,
          word_count = EXCLUDED.word_count,
          evaluation = EXCLUDED.evaluation,
          marks = EXCLUDED.marks,
          ai_score = EXCLUDED.ai_score,
          ai_feedback = EXCLUDED.ai_feedback
        `,
        [
          row.id,
          row.user_id,
          row.question_id ?? null,
          row.question_text ?? null,
          row.answer_text ?? null,
          row.answer_image_url ?? null,
          row.word_count ?? null,
          row.evaluation ?? null,
          row.marks ?? null,
          row.ai_score ?? null,
          row.ai_feedback ?? null,
          row.section ?? null,
          row.submitted_at ?? null,
          row.created_at ?? null,
        ],
      );
    }

    for (const row of local.study_plan) {
      await client.query(
        `
        INSERT INTO study_plan (
          id, user_id, date, tasks, total_tasks, completed_tasks,
          day_label, subject, topic, status, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3::date, $4::jsonb, $5, $6,
          $7, $8, $9, $10, $11, COALESCE($12::timestamptz, NOW()), COALESCE($13::timestamptz, NOW())
        )
        ON CONFLICT (id) DO UPDATE SET
          tasks = EXCLUDED.tasks,
          total_tasks = EXCLUDED.total_tasks,
          completed_tasks = EXCLUDED.completed_tasks,
          status = EXCLUDED.status,
          updated_at = NOW()
        `,
        [
          row.id,
          row.user_id,
          row.date ?? null,
          JSON.stringify(row.tasks ?? []),
          row.total_tasks ?? 0,
          row.completed_tasks ?? 0,
          row.day_label ?? null,
          row.subject ?? null,
          row.topic ?? null,
          row.status ?? "pending",
          row.notes ?? null,
          row.created_at ?? null,
          row.updated_at ?? null,
        ],
      );
    }

    for (const row of local.upsc_smart_notes) {
      await client.query(
        `
        INSERT INTO upsc_smart_notes (
          id, user_id, subject_id, subject_name, topic, slides_count, deck_json, current_slide, passed_checkpoints, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9::int[], COALESCE($10::timestamptz, NOW())
        )
        ON CONFLICT (id) DO UPDATE SET
          deck_json = EXCLUDED.deck_json,
          current_slide = EXCLUDED.current_slide,
          passed_checkpoints = EXCLUDED.passed_checkpoints
        `,
        [
          row.id,
          row.user_id,
          row.subject_id ?? null,
          row.subject_name ?? null,
          row.topic ?? "",
          row.slides_count ?? 0,
          JSON.stringify(row.deck_json ?? {}),
          row.current_slide ?? 0,
          Array.isArray(row.passed_checkpoints) ? row.passed_checkpoints : [],
          row.created_at ?? null,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        migrated: {
          user_accounts: local.user_accounts.length,
          profiles: local.profiles.length,
          auth_sessions: local.auth_sessions.length,
          chat_messages: local.chat_messages.length,
          prelims_attempts: local.prelims_attempts.length,
          mains_submissions: local.mains_submissions.length,
          study_plan: local.study_plan.length,
          upsc_smart_notes: local.upsc_smart_notes.length,
        },
      },
      null,
      2,
    ),
  );
};

run().catch((err) => {
  console.error("Local -> Neon migration failed:", err?.message || err);
  process.exit(1);
});
