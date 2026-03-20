/* global window */
(() => {
  const NS = "libsys.v1";

  const KEYS = {
    users: `${NS}.users`,
    staff: `${NS}.staff`,
    session: `${NS}.session`,
    readers: `${NS}.readers`,
    majors: `${NS}.majors`,
    titles: `${NS}.titles`,
    copies: `${NS}.copies`,
    loans: `${NS}.loans`,
    counters: `${NS}.counters`,
  };

  const nowIso = () => new Date().toISOString();

  function load(key, fallback) {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }

  function nextId(name, prefix) {
    const counters = load(KEYS.counters, {});
    const n = (counters[name] ?? 0) + 1;
    counters[name] = n;
    save(KEYS.counters, counters);
    return `${prefix}${String(n).padStart(5, "0")}`;
  }

  function resetAll() {
    Object.values(KEYS).forEach((k) => window.localStorage.removeItem(k));
    seed();
  }

  function seed() {
    // Users + staff
    const users = load(KEYS.users, null);
    if (!users) {
      const staff = [
        { staffId: "NV00001", fullName: "Nguyễn Admin", status: "ACTIVE" },
        { staffId: "NV00002", fullName: "Trần Thủ Thư", status: "ACTIVE" },
      ];
      save(KEYS.staff, staff);

      save(KEYS.users, [
        { username: "admin", password: "admin", role: "ADMIN", staffId: "NV00001", active: true },
        { username: "librarian", password: "librarian", role: "LIBRARIAN", staffId: "NV00002", active: true },
      ]);
    }

    // Majors
    const majors = load(KEYS.majors, null);
    if (!majors) {
      save(KEYS.majors, [
        { majorId: "CN001", name: "Công nghệ thông tin", description: "Tài liệu về CNTT, lập trình, hệ thống." },
        { majorId: "CN002", name: "Kinh tế", description: "Tài liệu về quản trị, tài chính, marketing." },
      ]);
    }

    // Readers
    const readers = load(KEYS.readers, null);
    if (!readers) {
      save(KEYS.readers, [
        { readerId: "DG00001", fullName: "Lê Minh Anh", className: "CTK45A", dob: "2004-08-14", gender: "Nữ" },
        { readerId: "DG00002", fullName: "Phạm Quốc Huy", className: "CTK45B", dob: "2004-02-02", gender: "Nam" },
      ]);
    }

    // Titles + copies
    const titles = load(KEYS.titles, null);
    const copies = load(KEYS.copies, null);
    if (!titles || !copies) {
      const baseTitles = [
        {
          titleId: "DS001",
          name: "Cấu trúc dữ liệu và giải thuật",
          publisher: "NXB Giáo Dục",
          pages: 520,
          size: "16x24cm",
          author: "Nhiều tác giả",
          majorId: "CN001",
          tags: ["cấu trúc dữ liệu", "giải thuật", "lập trình", "CTDL & GT"],
        },
        {
          titleId: "DS002",
          name: "Kinh tế vi mô cơ bản",
          publisher: "NXB Kinh Tế",
          pages: 340,
          size: "14.5x20.5cm",
          author: "P. Samuelson (biên soạn)",
          majorId: "CN002",
          tags: ["kinh tế vi mô", "cơ bản", "kinh tế học"],
        },
      ];
      save(KEYS.titles, baseTitles.map((t) => ({ ...t })));
      save(KEYS.copies, [
        { copyId: "S00001", titleId: "DS001", status: "AVAILABLE", importedAt: "2026-01-10" },
        { copyId: "S00002", titleId: "DS001", status: "AVAILABLE", importedAt: "2026-01-10" },
        { copyId: "S00003", titleId: "DS002", status: "AVAILABLE", importedAt: "2026-01-12" },
      ]);
    }

    // Loans
    const loans = load(KEYS.loans, null);
    if (!loans) {
      save(KEYS.loans, []);
    }
  }

  function getSession() {
    return load(KEYS.session, null);
  }

  function setSession(session) {
    save(KEYS.session, session);
  }

  function clearSession() {
    window.localStorage.removeItem(KEYS.session);
  }

  const Store = {
    KEYS,
    seed,
    resetAll,
    nowIso,
    nextId,
    getSession,
    setSession,
    clearSession,
    load,
    save,
  };

  window.LibraryStore = Store;
})();

