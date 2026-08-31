
    /*
      SUPABASE CONFIG
      ------------------------------------------------------------
      Publishable key is intended for browser/client-side use.
      Never place a Supabase secret/service-role key in this HTML.
    */
    window.MATTARY_SUPABASE_CONFIG = {
      url: "https://rmlkmnpnoasagwpvawxx.supabase.co",
      publishableKey: "sb_publishable_HZ8ax9-47Ycyl8qzfNL60Q_40LAtNIf",
      // Backward-safe default. Change to "password" only after applying sql/ migrations
      // and creating Supabase Auth accounts linked through public.users.auth_user_id.
      authMode: "legacy_anonymous"
    };

    window.MATTARY_SUPABASE_TABLES = {
      users: "users",
      classes: "classes",
      students: "students",
      assessments: "assessments",
      scores: "scores",
      pbdRecords: "pbd_records",
      pbdGroupLevels: "pbd_group_levels",
      pbdOverall: "pbd_overall",
      pbdLocks: "pbd_locks",
      interventions: "interventions",
      auditLogs: "audit_logs",
      headcount: "headcount",
      settings: "settings"
    };
  
