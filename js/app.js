/* global window, document */
(() => {
  const Store = () => window.LibraryStore;

  const ROLES = {
    ADMIN: "ADMIN",
    LIBRARIAN: "LIBRARIAN",
  };

  const COPY_STATUS = {
    AVAILABLE: "AVAILABLE",
    BORROWED: "BORROWED",
    DAMAGED: "DAMAGED",
    LOST: "LOST",
  };

  const LOAN_STATUS = {
    DANG_MUON: "DANG_MUON",
    DA_TRA: "DA_TRA",
  };

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDate(isoOrDate) {
    if (!isoOrDate) return "";
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return String(isoOrDate);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function pill(text, kind) {
    return `<span class="pill ${kind ?? ""}">${escapeHtml(text)}</span>`;
  }

  function requireLoggedIn() {
    const s = Store().getSession();
    if (!s) window.location.href = "./index.html";
  }

  function requireLoggedOut() {
    const s = Store().getSession();
    if (s) window.location.href = "./app.html";
  }

  function init() {
    Store().seed();
  }

  function bindLogin(formEl, errorEl) {
    formEl.addEventListener("submit", (e) => {
      e.preventDefault();
      errorEl.classList.add("hidden");
      const fd = new FormData(formEl);
      const username = String(fd.get("username") ?? "").trim();
      const password = String(fd.get("password") ?? "");
      const users = Store().load(Store().KEYS.users, []);
      const u = users.find((x) => x.username === username && x.password === password && x.active);
      if (!u) {
        errorEl.textContent = "Sai tài khoản/mật khẩu hoặc tài khoản bị khóa.";
        errorEl.classList.remove("hidden");
        return;
      }
      Store().setSession({ username: u.username, role: u.role, staffId: u.staffId, loginAt: Store().nowIso() });
      window.location.href = "./app.html";
    });
  }

  function logout() {
    Store().clearSession();
    window.location.href = "./index.html";
  }

  function getWhoAmI() {
    const s = Store().getSession();
    if (!s) return null;
    const staff = Store().load(Store().KEYS.staff, []);
    const st = staff.find((x) => x.staffId === s.staffId);
    return { ...s, staffName: st?.fullName ?? s.staffId };
  }

  function navItemsForRole(role) {
    const base = [
      { id: "home", label: "Tổng quan", roles: [ROLES.ADMIN, ROLES.LIBRARIAN] },
      { id: "readers", label: "Độc giả", roles: [ROLES.ADMIN, ROLES.LIBRARIAN] },
      { id: "majors", label: "Chuyên ngành", roles: [ROLES.ADMIN, ROLES.LIBRARIAN] },
      { id: "titles", label: "Đầu sách", roles: [ROLES.ADMIN, ROLES.LIBRARIAN] },
      { id: "copies", label: "Bản sao (Mã sách)", roles: [ROLES.ADMIN, ROLES.LIBRARIAN] },
      { id: "borrow", label: "Mượn sách", roles: [ROLES.ADMIN, ROLES.LIBRARIAN] },
      { id: "return", label: "Trả sách", roles: [ROLES.ADMIN, ROLES.LIBRARIAN] },
      { id: "reports", label: "Báo cáo", roles: [ROLES.ADMIN, ROLES.LIBRARIAN] },
      { id: "ai", label: "Gợi ý sách (AI)", roles: [ROLES.ADMIN, ROLES.LIBRARIAN] },
      { id: "admin", label: "Quản trị người dùng", roles: [ROLES.ADMIN] },
    ];
    return base.filter((x) => x.roles.includes(role));
  }

  function setActiveNav(navEl, activeId) {
    [...navEl.querySelectorAll("a[data-nav]")].forEach((a) => {
      if (a.getAttribute("data-nav") === activeId) a.classList.add("active");
      else a.classList.remove("active");
    });
  }

  function mountApp({ navEl, whoEl, logoutBtn, quickSearchEl, leftEl, rightEl }) {
    const me = getWhoAmI();
    if (!me) return;

    whoEl.textContent = `${me.staffName} • ${me.role} • ${me.username}`;
    logoutBtn.addEventListener("click", logout);

    const items = navItemsForRole(me.role);
    navEl.innerHTML = items.map((x) => `<a class="btn" href="#${x.id}" data-nav="${x.id}">${escapeHtml(x.label)}</a>`).join("");

    function render() {
      const hash = (window.location.hash || "#home").slice(1);
      const active = items.some((x) => x.id === hash) ? hash : "home";
      setActiveNav(navEl, active);

      const query = String(quickSearchEl.value ?? "").trim().toLowerCase();
      const ctx = { me, query, leftEl, rightEl };

      if (active === "home") return renderHome(ctx);
      if (active === "readers") return renderReaders(ctx);
      if (active === "majors") return renderMajors(ctx);
      if (active === "titles") return renderTitles(ctx);
      if (active === "copies") return renderCopies(ctx);
      if (active === "borrow") return renderBorrow(ctx);
      if (active === "return") return renderReturn(ctx);
      if (active === "reports") return renderReports(ctx);
      if (active === "ai") return renderAiRecommend(ctx);
      if (active === "admin") return renderAdmin(ctx);
      return renderHome(ctx);
    }

    window.addEventListener("hashchange", render);
    quickSearchEl.addEventListener("input", render);
    render();
  }

  // ---------- Helpers ----------

  function renderHome({ leftEl, rightEl }) {
    const readers = Store().load(Store().KEYS.readers, []);
    const titles = Store().load(Store().KEYS.titles, []);
    const copies = Store().load(Store().KEYS.copies, []);
    const loans = Store().load(Store().KEYS.loans, []);
    const openLoans = loans.filter((l) => !l.returnedAt);
    const available = copies.filter((c) => c.status === COPY_STATUS.AVAILABLE).length;

    leftEl.innerHTML = `
      <h2 class="h2">Tổng quan</h2>
      <div class="grid gap-10">
        <div class="alert info">
          <div><b>Độc giả</b>: ${readers.length}</div>
          <div><b>Đầu sách</b>: ${titles.length}</div>
          <div><b>Bản sao</b>: ${copies.length}</div>
        </div>
        <div class="alert">
          <div><b>Đang mượn</b>: ${openLoans.length}</div>
          <div><b>Sẵn sàng</b>: ${available}</div>
        </div>
      </div>
    `;

    const last = [...openLoans].slice(-8).reverse();
    rightEl.innerHTML = `
      <h2 class="h2">Phiếu đang mượn (gần đây)</h2>
      ${last.length ? renderLoansTable(last) : `<p class="muted">Chưa có phiếu mượn.</p>`}
    `;
  }

  function renderLoansTable(loans) {
    const readers = Store().load(Store().KEYS.readers, []);
    const titles = Store().load(Store().KEYS.titles, []);
    const copies = Store().load(Store().KEYS.copies, []);
    return `
      <table class="table">
        <thead>
          <tr>
            <th>Mã phiếu</th>
            <th>Mã sách</th>
            <th>Đầu sách</th>
            <th>Độc giả</th>
            <th>Ngày mượn</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          ${loans
            .map((l) => {
              const r = readers.find((x) => x.readerId === l.readerId);
              const c = copies.find((x) => x.copyId === l.copyId);
              const t = titles.find((x) => x.titleId === c?.titleId);
              const statusPill = l.returnedAt ? pill("Đã trả", "ok") : pill("Đang mượn", "warn");
              return `
                <tr>
                  <td><code>${escapeHtml(l.loanId)}</code></td>
                  <td><code>${escapeHtml(l.copyId)}</code></td>
                  <td>${escapeHtml(t?.name ?? "")}</td>
                  <td>${escapeHtml(r?.fullName ?? "")} <span class="muted small">(${escapeHtml(l.readerId)})</span></td>
                  <td><code>${escapeHtml(fmtDate(l.borrowedAt))}</code></td>
                  <td>${statusPill}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderReaders({ leftEl, rightEl, query }) {
    const readers = Store().load(Store().KEYS.readers, []);
    const loans = Store().load(Store().KEYS.loans, []);
    const openLoans = loans.filter((l) => !l.returnedAt);

    const filtered = query
      ? readers.filter((r) => `${r.readerId} ${r.fullName} ${r.className}`.toLowerCase().includes(query))
      : readers;

    leftEl.innerHTML = `
      <h2 class="h2">Quản lý thẻ thư viện (Độc giả)</h2>
      <form id="readerForm" class="grid gap-10">
        <div class="grid cols-2 gap-10">
          <label class="field">
            <span>Mã độc giả</span>
            <input name="readerId" placeholder="DG00003" />
          </label>
          <label class="field">
            <span>Họ tên</span>
            <input name="fullName" required placeholder="Nguyễn Văn A" />
          </label>
        </div>
        <div class="grid cols-2 gap-10">
          <label class="field">
            <span>Lớp</span>
            <input name="className" required placeholder="CTK45A" />
          </label>
          <label class="field">
            <span>Ngày sinh</span>
            <input name="dob" type="date" required />
          </label>
        </div>
        <div class="grid cols-2 gap-10">
          <label class="field">
            <span>Giới tính</span>
            <select name="gender" required>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </select>
          </label>
          <div class="row gap-10 align-center wrap">
            <button class="btn primary" type="submit">Lưu</button>
            <button class="btn" type="button" id="readerClearBtn">Làm mới</button>
            <button class="btn" type="button" id="readerPrintBtn">In thẻ</button>
          </div>
        </div>
        <div id="readerMsg" class="alert info hidden"></div>
        <div id="readerErr" class="alert danger hidden"></div>
      </form>
    `;

    rightEl.innerHTML = `
      <div class="row space-between align-center">
        <h2 class="h2" style="margin:0">Danh sách độc giả</h2>
        <span class="muted small">Gõ ở ô "Tìm nhanh" để lọc</span>
      </div>
      <div class="divider"></div>
      ${filtered.length ? renderReadersTable(filtered, openLoans) : `<p class="muted">Không có dữ liệu.</p>`}
    `;

    // bind table actions (scripts injected via innerHTML don't execute reliably)
    rightEl.querySelectorAll('button[data-act="edit"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const all = Store().load(Store().KEYS.readers, []);
        const r = all.find((x) => x.readerId === id);
        const form = leftEl.querySelector("#readerForm");
        if (!r || !form) return;
        form.readerId.value = r.readerId;
        form.fullName.value = r.fullName;
        form.className.value = r.className;
        form.dob.value = r.dob;
        form.gender.value = r.gender;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    rightEl.querySelectorAll('button[data-act="del"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const all = Store().load(Store().KEYS.readers, []);
        const loansAll = Store().load(Store().KEYS.loans, []);
        const open = loansAll.some((l) => l.readerId === id && !l.returnedAt);
        if (open) {
          alert("Không thể xóa độc giả khi còn phiếu chưa trả.");
          return;
        }
        if (!confirm(`Xóa độc giả ${id}?`)) return;
        Store().save(Store().KEYS.readers, all.filter((x) => x.readerId !== id));
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
    });

    const form = leftEl.querySelector("#readerForm");
    const msg = leftEl.querySelector("#readerMsg");
    const err = leftEl.querySelector("#readerErr");
    const clearBtn = leftEl.querySelector("#readerClearBtn");
    const printBtn = leftEl.querySelector("#readerPrintBtn");

    function clear() {
      form.reset();
      form.readerId.value = "";
      msg.classList.add("hidden");
      err.classList.add("hidden");
    }

    clearBtn.addEventListener("click", clear);

    printBtn.addEventListener("click", () => {
      const id = String(form.readerId.value ?? "").trim();
      const r = readers.find((x) => x.readerId === id);
      if (!r) {
        err.textContent = "Chọn độc giả (bấm 'Sửa' ở danh sách) trước khi in thẻ.";
        err.classList.remove("hidden");
        return;
      }
      const w = window.open("", "_blank", "width=520,height=380");
      w.document.write(`
        <html><head><title>Thẻ thư viện</title>
        <style>
          body{font-family:system-ui;margin:24px}
          .card{border:1px solid #bbb;border-radius:12px;padding:16px}
          .h{font-weight:700;font-size:18px;margin-bottom:10px}
          .row{display:flex;justify-content:space-between}
          code{font-family:ui-monospace}
        </style>
        </head><body>
          <div class="card">
            <div class="h">THẺ THƯ VIỆN</div>
            <div class="row"><div>Mã độc giả:</div><div><code>${escapeHtml(r.readerId)}</code></div></div>
            <div class="row"><div>Họ tên:</div><div>${escapeHtml(r.fullName)}</div></div>
            <div class="row"><div>Lớp:</div><div>${escapeHtml(r.className)}</div></div>
            <div class="row"><div>Ngày sinh:</div><div><code>${escapeHtml(r.dob)}</code></div></div>
            <div class="row"><div>Giới tính:</div><div>${escapeHtml(r.gender)}</div></div>
          </div>
          <script>window.print();</script>
        </body></html>
      `);
      w.document.close();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      msg.classList.add("hidden");
      err.classList.add("hidden");
      const fd = new FormData(form);
      const readerId = String(fd.get("readerId") ?? "").trim() || Store().nextId("reader", "DG");
      const fullName = String(fd.get("fullName") ?? "").trim();
      const className = String(fd.get("className") ?? "").trim();
      const dob = String(fd.get("dob") ?? "").trim();
      const gender = String(fd.get("gender") ?? "").trim();

      const all = Store().load(Store().KEYS.readers, []);
      const existed = all.find((x) => x.readerId === readerId);
      if (!existed && all.some((x) => x.readerId === readerId)) {
        err.textContent = "Mã độc giả đã tồn tại.";
        err.classList.remove("hidden");
        return;
      }

      if (existed) {
        Object.assign(existed, { fullName, className, dob, gender });
      } else {
        all.push({ readerId, fullName, className, dob, gender });
      }
      Store().save(Store().KEYS.readers, all);
      window.location.hash = "#readers";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  }

  function renderReadersTable(readers, openLoans) {
    const openByReader = new Map();
    openLoans.forEach((l) => openByReader.set(l.readerId, (openByReader.get(l.readerId) ?? 0) + 1));
    return `
      <table class="table">
        <thead>
          <tr>
            <th>Mã độc giả</th>
            <th>Họ tên</th>
            <th>Lớp</th>
            <th>Ngày sinh</th>
            <th>Giới tính</th>
            <th>Đang mượn</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${readers
            .map((r) => {
              const cnt = openByReader.get(r.readerId) ?? 0;
              return `
                <tr>
                  <td><code>${escapeHtml(r.readerId)}</code></td>
                  <td>${escapeHtml(r.fullName)}</td>
                  <td>${escapeHtml(r.className)}</td>
                  <td><code>${escapeHtml(r.dob)}</code></td>
                  <td>${escapeHtml(r.gender)}</td>
                  <td>${cnt ? pill(String(cnt), "warn") : pill("0", "")}</td>
                  <td class="row gap-10 wrap">
                    <button class="btn" data-act="edit" data-id="${escapeHtml(r.readerId)}">Sửa</button>
                    <button class="btn danger" data-act="del" data-id="${escapeHtml(r.readerId)}">Xóa</button>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderMajors({ leftEl, rightEl, query }) {
    const majors = Store().load(Store().KEYS.majors, []);
    const filtered = query
      ? majors.filter((m) => `${m.majorId} ${m.name}`.toLowerCase().includes(query))
      : majors;

    leftEl.innerHTML = `
      <h2 class="h2">Chuyên ngành</h2>
      <form id="majorForm" class="grid gap-10">
        <div class="grid cols-2 gap-10">
          <label class="field"><span>Mã chuyên ngành</span><input name="majorId" placeholder="CN003" /></label>
          <label class="field"><span>Tên chuyên ngành</span><input name="name" required /></label>
        </div>
        <label class="field"><span>Mô tả</span><textarea name="description" placeholder="Mô tả..."></textarea></label>
        <div class="row gap-10 wrap">
          <button class="btn primary" type="submit">Lưu</button>
          <button class="btn" type="button" id="majorClearBtn">Làm mới</button>
        </div>
        <div id="majorErr" class="alert danger hidden"></div>
      </form>
    `;

    rightEl.innerHTML = `
      <div class="row space-between align-center">
        <h2 class="h2" style="margin:0">Danh sách chuyên ngành</h2>
        <span class="muted small">Lọc bằng "Tìm nhanh"</span>
      </div>
      <div class="divider"></div>
      ${filtered.length ? renderMajorsTable(filtered) : `<p class="muted">Không có dữ liệu.</p>`}
    `;

    rightEl.querySelectorAll('button[data-act="edit"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const all = Store().load(Store().KEYS.majors, []);
        const m = all.find((x) => x.majorId === id);
        const form = leftEl.querySelector("#majorForm");
        if (!m || !form) return;
        form.majorId.value = m.majorId;
        form.name.value = m.name;
        form.description.value = m.description || "";
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    rightEl.querySelectorAll('button[data-act="del"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const all = Store().load(Store().KEYS.majors, []);
        const titles = Store().load(Store().KEYS.titles, []);
        const used = titles.some((t) => t.majorId === id);
        if (used) {
          alert("Không thể xóa chuyên ngành khi đang có đầu sách thuộc chuyên ngành.");
          return;
        }
        if (!confirm(`Xóa chuyên ngành ${id}?`)) return;
        Store().save(Store().KEYS.majors, all.filter((x) => x.majorId !== id));
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
    });

    const form = leftEl.querySelector("#majorForm");
    const err = leftEl.querySelector("#majorErr");
    const clearBtn = leftEl.querySelector("#majorClearBtn");

    clearBtn.addEventListener("click", () => {
      form.reset();
      form.majorId.value = "";
      err.classList.add("hidden");
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      err.classList.add("hidden");
      const fd = new FormData(form);
      const majorId = String(fd.get("majorId") ?? "").trim() || Store().nextId("major", "CN");
      const name = String(fd.get("name") ?? "").trim();
      const description = String(fd.get("description") ?? "").trim();

      const all = Store().load(Store().KEYS.majors, []);
      const existed = all.find((x) => x.majorId === majorId);
      if (!existed && all.some((x) => x.majorId === majorId)) {
        err.textContent = "Mã chuyên ngành đã tồn tại.";
        err.classList.remove("hidden");
        return;
      }
      if (existed) Object.assign(existed, { name, description });
      else all.push({ majorId, name, description });
      Store().save(Store().KEYS.majors, all);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  }

  function renderMajorsTable(majors) {
    return `
      <table class="table">
        <thead><tr><th>Mã</th><th>Tên</th><th>Mô tả</th><th>Thao tác</th></tr></thead>
        <tbody>
          ${majors
            .map(
              (m) => `
            <tr>
              <td><code>${escapeHtml(m.majorId)}</code></td>
              <td>${escapeHtml(m.name)}</td>
              <td class="muted">${escapeHtml(m.description)}</td>
              <td class="row gap-10 wrap">
                <button class="btn" data-act="edit" data-id="${escapeHtml(m.majorId)}">Sửa</button>
                <button class="btn danger" data-act="del" data-id="${escapeHtml(m.majorId)}">Xóa</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderTitles({ leftEl, rightEl, query }) {
    const titles = Store().load(Store().KEYS.titles, []);
    const majors = Store().load(Store().KEYS.majors, []);
    const copies = Store().load(Store().KEYS.copies, []);

    const filtered = query
      ? titles.filter((t) => `${t.titleId} ${t.name} ${t.author}`.toLowerCase().includes(query))
      : titles;

    leftEl.innerHTML = `
      <h2 class="h2">Đầu sách</h2>
      <form id="titleForm" class="grid gap-10">
        <div class="grid cols-2 gap-10">
          <label class="field"><span>Mã đầu sách</span><input name="titleId" placeholder="DS003" /></label>
          <label class="field"><span>Tên đầu sách</span><input name="name" required /></label>
        </div>
        <div class="grid cols-2 gap-10">
          <label class="field"><span>Nhà xuất bản</span><input name="publisher" required /></label>
          <label class="field"><span>Tác giả</span><input name="author" required /></label>
        </div>
        <div class="grid cols-2 gap-10">
          <label class="field"><span>Số trang</span><input name="pages" type="number" min="1" required /></label>
          <label class="field"><span>Kích thước</span><input name="size" placeholder="16x24cm" /></label>
        </div>
        <label class="field">
          <span>Chuyên ngành</span>
          <select name="majorId" required>
            ${majors.map((m) => `<option value="${escapeHtml(m.majorId)}">${escapeHtml(m.name)} (${escapeHtml(m.majorId)})</option>`).join("")}
          </select>
        </label>
        <div class="row gap-10 wrap">
          <button class="btn primary" type="submit">Lưu</button>
          <button class="btn" type="button" id="titleClearBtn">Làm mới</button>
        </div>
        <div id="titleErr" class="alert danger hidden"></div>
      </form>
    `;

    rightEl.innerHTML = `
      <div class="row space-between align-center">
        <h2 class="h2" style="margin:0">Danh sách đầu sách</h2>
        <span class="muted small">Lọc bằng "Tìm nhanh"</span>
      </div>
      <div class="divider"></div>
      ${filtered.length ? renderTitlesTable(filtered, majors, copies) : `<p class="muted">Không có dữ liệu.</p>`}
    `;

    rightEl.querySelectorAll('button[data-act="edit"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const all = Store().load(Store().KEYS.titles, []);
        const t = all.find((x) => x.titleId === id);
        const form = leftEl.querySelector("#titleForm");
        if (!t || !form) return;
        form.titleId.value = t.titleId;
        form.name.value = t.name;
        form.publisher.value = t.publisher;
        form.pages.value = t.pages;
        form.size.value = t.size || "";
        form.author.value = t.author;
        form.majorId.value = t.majorId;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    rightEl.querySelectorAll('button[data-act="del"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const all = Store().load(Store().KEYS.titles, []);
        const copiesAll = Store().load(Store().KEYS.copies, []);
        const used = copiesAll.some((c) => c.titleId === id);
        if (used) {
          alert("Không thể xóa đầu sách khi còn bản sao. Hãy xóa bản sao trước.");
          return;
        }
        if (!confirm(`Xóa đầu sách ${id}?`)) return;
        Store().save(Store().KEYS.titles, all.filter((x) => x.titleId !== id));
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
    });

    const form = leftEl.querySelector("#titleForm");
    const err = leftEl.querySelector("#titleErr");
    const clearBtn = leftEl.querySelector("#titleClearBtn");

    clearBtn.addEventListener("click", () => {
      form.reset();
      form.titleId.value = "";
      err.classList.add("hidden");
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      err.classList.add("hidden");
      const fd = new FormData(form);
      const titleId = String(fd.get("titleId") ?? "").trim() || Store().nextId("title", "DS");
      const payload = {
        titleId,
        name: String(fd.get("name") ?? "").trim(),
        publisher: String(fd.get("publisher") ?? "").trim(),
        pages: Number(fd.get("pages") ?? 0),
        size: String(fd.get("size") ?? "").trim(),
        author: String(fd.get("author") ?? "").trim(),
        majorId: String(fd.get("majorId") ?? "").trim(),
      };

      const all = Store().load(Store().KEYS.titles, []);
      const existed = all.find((x) => x.titleId === titleId);
      if (existed) Object.assign(existed, payload);
      else all.push(payload);
      Store().save(Store().KEYS.titles, all);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  }

  function renderTitlesTable(titles, majors, copies) {
    const countByTitle = new Map();
    copies.forEach((c) => countByTitle.set(c.titleId, (countByTitle.get(c.titleId) ?? 0) + 1));
    return `
      <table class="table">
        <thead>
          <tr>
            <th>Mã</th><th>Tên</th><th>Tác giả</th><th>NXB</th><th>CN</th><th>Bản sao</th><th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          ${titles
            .map((t) => {
              const m = majors.find((x) => x.majorId === t.majorId);
              const cnt = countByTitle.get(t.titleId) ?? 0;
              return `
                <tr>
                  <td><code>${escapeHtml(t.titleId)}</code></td>
                  <td>${escapeHtml(t.name)}</td>
                  <td>${escapeHtml(t.author)}</td>
                  <td>${escapeHtml(t.publisher)}</td>
                  <td>${escapeHtml(m?.name ?? t.majorId)} <span class="muted small">(${escapeHtml(t.majorId)})</span></td>
                  <td>${pill(String(cnt), cnt ? "ok" : "")}</td>
                  <td class="row gap-10 wrap">
                    <button class="btn" data-act="edit" data-id="${escapeHtml(t.titleId)}">Sửa</button>
                    <button class="btn danger" data-act="del" data-id="${escapeHtml(t.titleId)}">Xóa</button>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderCopies({ leftEl, rightEl, query }) {
    const titles = Store().load(Store().KEYS.titles, []);
    const copies = Store().load(Store().KEYS.copies, []);
    const loans = Store().load(Store().KEYS.loans, []);
    const openLoanByCopy = new Map();
    loans.filter((l) => !l.returnedAt).forEach((l) => openLoanByCopy.set(l.copyId, l));

    const filtered = query
      ? copies.filter((c) => `${c.copyId} ${c.titleId} ${c.status}`.toLowerCase().includes(query))
      : copies;

    leftEl.innerHTML = `
      <h2 class="h2">Bản sao (Mã sách)</h2>
      <form id="copyForm" class="grid gap-10">
        <div class="grid cols-2 gap-10">
          <label class="field"><span>Mã sách</span><input name="copyId" placeholder="S00004" /></label>
          <label class="field">
            <span>Đầu sách</span>
            <select name="titleId" required>
              ${titles.map((t) => `<option value="${escapeHtml(t.titleId)}">${escapeHtml(t.name)} (${escapeHtml(t.titleId)})</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="grid cols-2 gap-10">
          <label class="field">
            <span>Tình trạng</span>
            <select name="status" required>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="BORROWED">BORROWED</option>
              <option value="DAMAGED">DAMAGED</option>
              <option value="LOST">LOST</option>
            </select>
          </label>
          <label class="field"><span>Ngày nhập</span><input name="importedAt" type="date" required /></label>
        </div>
        <div class="row gap-10 wrap">
          <button class="btn primary" type="submit">Lưu</button>
          <button class="btn" type="button" id="copyClearBtn">Làm mới</button>
        </div>
        <div id="copyErr" class="alert danger hidden"></div>
      </form>
    `;

    rightEl.innerHTML = `
      <div class="row space-between align-center">
        <h2 class="h2" style="margin:0">Danh sách bản sao</h2>
        <span class="muted small">Lọc bằng "Tìm nhanh"</span>
      </div>
      <div class="divider"></div>
      ${filtered.length ? renderCopiesTable(filtered, titles, openLoanByCopy) : `<p class="muted">Không có dữ liệu.</p>`}
    `;

    rightEl.querySelectorAll('button[data-act="edit"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const all = Store().load(Store().KEYS.copies, []);
        const c = all.find((x) => x.copyId === id);
        const form = leftEl.querySelector("#copyForm");
        if (!c || !form) return;
        form.copyId.value = c.copyId;
        form.titleId.value = c.titleId;
        form.status.value = c.status;
        form.importedAt.value = c.importedAt;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    rightEl.querySelectorAll('button[data-act="del"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const all = Store().load(Store().KEYS.copies, []);
        const loansAll = Store().load(Store().KEYS.loans, []);
        const open = loansAll.some((l) => l.copyId === id && !l.returnedAt);
        if (open) {
          alert("Không thể xóa bản sao khi đang có phiếu chưa trả.");
          return;
        }
        if (!confirm(`Xóa bản sao ${id}?`)) return;
        Store().save(Store().KEYS.copies, all.filter((x) => x.copyId !== id));
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
    });

    const form = leftEl.querySelector("#copyForm");
    const err = leftEl.querySelector("#copyErr");
    const clearBtn = leftEl.querySelector("#copyClearBtn");

    clearBtn.addEventListener("click", () => {
      form.reset();
      form.copyId.value = "";
      err.classList.add("hidden");
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      err.classList.add("hidden");
      const fd = new FormData(form);
      const copyId = String(fd.get("copyId") ?? "").trim() || Store().nextId("copy", "S");
      const titleId = String(fd.get("titleId") ?? "").trim();
      const status = String(fd.get("status") ?? "").trim();
      const importedAt = String(fd.get("importedAt") ?? "").trim();

      const all = Store().load(Store().KEYS.copies, []);
      const existed = all.find((x) => x.copyId === copyId);
      if (status === COPY_STATUS.AVAILABLE) {
        // ok
      }
      if (status === COPY_STATUS.BORROWED) {
        // allow set, but should match open loan if any (demo: keep simple)
      }

      if (existed) Object.assign(existed, { titleId, status, importedAt });
      else all.push({ copyId, titleId, status, importedAt });
      Store().save(Store().KEYS.copies, all);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  }

  function renderCopiesTable(copies, titles, openLoanByCopy) {
    return `
      <table class="table">
        <thead><tr><th>Mã sách</th><th>Đầu sách</th><th>Tình trạng</th><th>Ngày nhập</th><th>Thao tác</th></tr></thead>
        <tbody>
          ${copies
            .map((c) => {
              const t = titles.find((x) => x.titleId === c.titleId);
              const stKind =
                c.status === COPY_STATUS.AVAILABLE ? "ok" : c.status === COPY_STATUS.BORROWED ? "warn" : "bad";
              const note = c.status === COPY_STATUS.BORROWED && openLoanByCopy.get(c.copyId) ? " (có phiếu)" : "";
              return `
                <tr>
                  <td><code>${escapeHtml(c.copyId)}</code></td>
                  <td>${escapeHtml(t?.name ?? "")} <span class="muted small">(${escapeHtml(c.titleId)})</span></td>
                  <td>${pill(c.status + note, stKind)}</td>
                  <td><code>${escapeHtml(fmtDate(c.importedAt))}</code></td>
                  <td class="row gap-10 wrap">
                    <button class="btn" data-act="edit" data-id="${escapeHtml(c.copyId)}">Sửa</button>
                    <button class="btn danger" data-act="del" data-id="${escapeHtml(c.copyId)}">Xóa</button>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderBorrow({ leftEl, rightEl, me, query }) {
    const readers = Store().load(Store().KEYS.readers, []);
    const copies = Store().load(Store().KEYS.copies, []);
    const titles = Store().load(Store().KEYS.titles, []);
    const loans = Store().load(Store().KEYS.loans, []);

    const availableCopies = copies.filter((c) => c.status === COPY_STATUS.AVAILABLE);

    leftEl.innerHTML = `
      <h2 class="h2">Lập phiếu mượn (mỗi lần 1 cuốn)</h2>
      <form id="borrowForm" class="grid gap-10">
        <div class="grid cols-2 gap-10">
          <label class="field">
            <span>Mã độc giả</span>
            <input name="readerId" required placeholder="DG00001" />
          </label>
          <label class="field">
            <span>Mã sách (bản sao)</span>
            <input name="copyId" required placeholder="S00001" />
          </label>
        </div>
        <div class="grid cols-2 gap-10">
          <label class="field">
            <span>Ngày mượn</span>
            <input name="borrowedAt" type="date" required value="${escapeHtml(fmtDate(new Date()))}" />
          </label>
          <label class="field">
            <span>Tình trạng phiếu</span>
            <select name="status" required>
              <option value="${LOAN_STATUS.DANG_MUON}">ĐANG_MƯỢN</option>
            </select>
          </label>
        </div>
        <div class="row gap-10 wrap">
          <button class="btn primary" type="submit">Ghi nhận mượn</button>
          <button class="btn" type="button" id="borrowAutoBtn">Chọn nhanh (1 độc giả + 1 sách sẵn sàng)</button>
        </div>
        <div id="borrowMsg" class="alert info hidden"></div>
        <div id="borrowErr" class="alert danger hidden"></div>
      </form>
    `;

    const filteredAvail = query
      ? availableCopies.filter((c) => `${c.copyId} ${c.titleId}`.toLowerCase().includes(query))
      : availableCopies;

    rightEl.innerHTML = `
      <h2 class="h2">Sách sẵn sàng để mượn</h2>
      ${filteredAvail.length ? renderAvailableCopies(filteredAvail, titles) : `<p class="muted">Không có bản sao AVAILABLE.</p>`}
      <div class="divider"></div>
      <h2 class="h2">Phiếu đang mượn</h2>
      ${loans.filter(l => !l.returnedAt).length ? renderLoansTable(loans.filter(l => !l.returnedAt).slice(-10).reverse()) : `<p class="muted">Chưa có phiếu đang mượn.</p>`}
    `;

    const form = leftEl.querySelector("#borrowForm");
    const msg = leftEl.querySelector("#borrowMsg");
    const err = leftEl.querySelector("#borrowErr");
    const autoBtn = leftEl.querySelector("#borrowAutoBtn");

    autoBtn.addEventListener("click", () => {
      const r = readers[0];
      const c = availableCopies[0];
      if (!r || !c) return;
      form.readerId.value = r.readerId;
      form.copyId.value = c.copyId;
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      msg.classList.add("hidden");
      err.classList.add("hidden");
      const fd = new FormData(form);
      const readerId = String(fd.get("readerId") ?? "").trim();
      const copyId = String(fd.get("copyId") ?? "").trim();
      const borrowedAt = String(fd.get("borrowedAt") ?? "").trim();

      const readersAll = Store().load(Store().KEYS.readers, []);
      const copiesAll = Store().load(Store().KEYS.copies, []);
      const loansAll = Store().load(Store().KEYS.loans, []);

      const r = readersAll.find((x) => x.readerId === readerId);
      if (!r) {
        err.textContent = "Không tìm thấy độc giả. Vui lòng tạo thẻ thư viện trước.";
        err.classList.remove("hidden");
        return;
      }

      const c = copiesAll.find((x) => x.copyId === copyId);
      if (!c) {
        err.textContent = "Không tìm thấy mã sách (bản sao).";
        err.classList.remove("hidden");
        return;
      }
      if (c.status !== COPY_STATUS.AVAILABLE) {
        err.textContent = "Sách không ở trạng thái AVAILABLE nên không thể mượn.";
        err.classList.remove("hidden");
        return;
      }
      const open = loansAll.some((l) => l.copyId === copyId && !l.returnedAt);
      if (open) {
        err.textContent = "Mã sách đang có phiếu chưa trả.";
        err.classList.remove("hidden");
        return;
      }

      const loanId = Store().nextId("loan", "PM");
      loansAll.push({
        loanId,
        copyId,
        readerId,
        staffId: me.staffId,
        borrowedAt,
        returnedAt: null,
        status: LOAN_STATUS.DANG_MUON,
      });
      c.status = COPY_STATUS.BORROWED;
      Store().save(Store().KEYS.loans, loansAll);
      Store().save(Store().KEYS.copies, copiesAll);
      msg.textContent = `Đã tạo phiếu mượn ${loanId}.`;
      msg.classList.remove("hidden");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  }

  function renderAvailableCopies(copies, titles) {
    return `
      <table class="table">
        <thead><tr><th>Mã sách</th><th>Đầu sách</th><th>Trạng thái</th></tr></thead>
        <tbody>
          ${copies
            .map((c) => {
              const t = titles.find((x) => x.titleId === c.titleId);
              return `
                <tr>
                  <td><code>${escapeHtml(c.copyId)}</code></td>
                  <td>${escapeHtml(t?.name ?? "")} <span class="muted small">(${escapeHtml(c.titleId)})</span></td>
                  <td>${pill("AVAILABLE", "ok")}</td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderReturn({ leftEl, rightEl, me, query }) {
    const loans = Store().load(Store().KEYS.loans, []);
    const openLoans = loans.filter((l) => !l.returnedAt);
    const readers = Store().load(Store().KEYS.readers, []);
    const copies = Store().load(Store().KEYS.copies, []);
    const titles = Store().load(Store().KEYS.titles, []);

    const filtered = query
      ? openLoans.filter((l) => `${l.loanId} ${l.copyId} ${l.readerId}`.toLowerCase().includes(query))
      : openLoans;

    leftEl.innerHTML = `
      <h2 class="h2">Trả sách</h2>
      <form id="returnForm" class="grid gap-10">
        <div class="grid cols-2 gap-10">
          <label class="field"><span>Mã phiếu</span><input name="loanId" placeholder="PM00001" /></label>
          <label class="field"><span>Mã sách</span><input name="copyId" placeholder="S00001" /></label>
        </div>
        <div class="grid cols-2 gap-10">
          <label class="field"><span>Ngày trả</span><input name="returnedAt" type="date" required value="${escapeHtml(fmtDate(new Date()))}" /></label>
          <label class="field">
            <span>Tình trạng sách khi trả</span>
            <select name="copyStatus" required>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="DAMAGED">DAMAGED</option>
              <option value="LOST">LOST</option>
            </select>
          </label>
        </div>
        <div class="row gap-10 wrap">
          <button class="btn primary" type="submit">Ghi nhận trả</button>
          <button class="btn" type="button" id="returnAutoBtn">Chọn nhanh (phiếu đầu tiên)</button>
        </div>
        <div id="returnMsg" class="alert info hidden"></div>
        <div id="returnErr" class="alert danger hidden"></div>
      </form>
    `;

    rightEl.innerHTML = `
      <div class="row space-between align-center">
        <h2 class="h2" style="margin:0">Danh sách phiếu chưa trả</h2>
        <span class="muted small">Lọc bằng "Tìm nhanh"</span>
      </div>
      <div class="divider"></div>
      ${filtered.length ? renderOpenLoansTable(filtered, readers, copies, titles) : `<p class="muted">Không còn phiếu chưa trả.</p>`}
    `;

    rightEl.querySelectorAll('button[data-act="pick"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-loan");
        const loansAll = Store().load(Store().KEYS.loans, []);
        const l = loansAll.find((x) => x.loanId === id && !x.returnedAt);
        const form = leftEl.querySelector("#returnForm");
        if (!l || !form) return;
        form.loanId.value = l.loanId;
        form.copyId.value = l.copyId;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    const form = leftEl.querySelector("#returnForm");
    const msg = leftEl.querySelector("#returnMsg");
    const err = leftEl.querySelector("#returnErr");
    const autoBtn = leftEl.querySelector("#returnAutoBtn");

    autoBtn.addEventListener("click", () => {
      const l = openLoans[0];
      if (!l) return;
      form.loanId.value = l.loanId;
      form.copyId.value = l.copyId;
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      msg.classList.add("hidden");
      err.classList.add("hidden");
      const fd = new FormData(form);
      const loanId = String(fd.get("loanId") ?? "").trim();
      const copyId = String(fd.get("copyId") ?? "").trim();
      const returnedAt = String(fd.get("returnedAt") ?? "").trim();
      const copyStatus = String(fd.get("copyStatus") ?? "").trim();

      const loansAll = Store().load(Store().KEYS.loans, []);
      const copiesAll = Store().load(Store().KEYS.copies, []);

      let loan = null;
      if (loanId) loan = loansAll.find((l) => l.loanId === loanId && !l.returnedAt);
      if (!loan && copyId) loan = loansAll.find((l) => l.copyId === copyId && !l.returnedAt);
      if (!loan) {
        err.textContent = "Không tìm thấy phiếu chưa trả theo mã phiếu/mã sách.";
        err.classList.remove("hidden");
        return;
      }

      const c = copiesAll.find((x) => x.copyId === loan.copyId);
      if (!c) {
        err.textContent = "Không tìm thấy bản sao tương ứng.";
        err.classList.remove("hidden");
        return;
      }

      loan.returnedAt = returnedAt;
      loan.status = LOAN_STATUS.DA_TRA;
      loan.returnStaffId = me.staffId;
      c.status = copyStatus;

      Store().save(Store().KEYS.loans, loansAll);
      Store().save(Store().KEYS.copies, copiesAll);
      msg.textContent = `Đã ghi nhận trả cho phiếu ${loan.loanId}.`;
      msg.classList.remove("hidden");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  }

  function renderOpenLoansTable(loans, readers, copies, titles) {
    return `
      <table class="table">
        <thead><tr><th>Mã phiếu</th><th>Mã sách</th><th>Đầu sách</th><th>Độc giả</th><th>Ngày mượn</th><th>Thao tác</th></tr></thead>
        <tbody>
          ${loans
            .map((l) => {
              const r = readers.find((x) => x.readerId === l.readerId);
              const c = copies.find((x) => x.copyId === l.copyId);
              const t = titles.find((x) => x.titleId === c?.titleId);
              return `
                <tr>
                  <td><code>${escapeHtml(l.loanId)}</code></td>
                  <td><code>${escapeHtml(l.copyId)}</code></td>
                  <td>${escapeHtml(t?.name ?? "")}</td>
                  <td>${escapeHtml(r?.fullName ?? "")} <span class="muted small">(${escapeHtml(l.readerId)})</span></td>
                  <td><code>${escapeHtml(fmtDate(l.borrowedAt))}</code></td>
                  <td><button class="btn" data-act="pick" data-loan="${escapeHtml(l.loanId)}">Chọn</button></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderReports({ leftEl, rightEl }) {
    const loans = Store().load(Store().KEYS.loans, []);
    const copies = Store().load(Store().KEYS.copies, []);
    const titles = Store().load(Store().KEYS.titles, []);
    const readers = Store().load(Store().KEYS.readers, []);

    // Top borrowed titles
    const borrowCountByTitle = new Map();
    loans.forEach((l) => {
      const c = copies.find((x) => x.copyId === l.copyId);
      if (!c) return;
      borrowCountByTitle.set(c.titleId, (borrowCountByTitle.get(c.titleId) ?? 0) + 1);
    });
    const top = [...borrowCountByTitle.entries()]
      .map(([titleId, count]) => ({ titleId, count, title: titles.find((t) => t.titleId === titleId) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Readers with open loans
    const open = loans.filter((l) => !l.returnedAt);
    const openByReader = new Map();
    open.forEach((l) => openByReader.set(l.readerId, (openByReader.get(l.readerId) ?? 0) + 1));
    const debtors = [...openByReader.entries()]
      .map(([readerId, count]) => ({ readerId, count, reader: readers.find((r) => r.readerId === readerId) }))
      .sort((a, b) => b.count - a.count);

    leftEl.innerHTML = `
      <h2 class="h2">Báo cáo: Đầu sách mượn nhiều nhất</h2>
      ${
        top.length
          ? `
        <table class="table">
          <thead><tr><th>Hạng</th><th>Mã đầu sách</th><th>Tên</th><th>Số lượt mượn</th></tr></thead>
          <tbody>
            ${top
              .map(
                (x, i) => `
              <tr>
                <td>${i + 1}</td>
                <td><code>${escapeHtml(x.titleId)}</code></td>
                <td>${escapeHtml(x.title?.name ?? "")}</td>
                <td>${pill(String(x.count), "ok")}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>`
          : `<p class="muted">Chưa có dữ liệu mượn.</p>`
      }
    `;

    rightEl.innerHTML = `
      <h2 class="h2">Báo cáo: Độc giả chưa trả sách</h2>
      ${
        debtors.length
          ? `
        <table class="table">
          <thead><tr><th>Mã độc giả</th><th>Họ tên</th><th>Lớp</th><th>Số phiếu chưa trả</th></tr></thead>
          <tbody>
            ${debtors
              .map(
                (x) => `
              <tr>
                <td><code>${escapeHtml(x.readerId)}</code></td>
                <td>${escapeHtml(x.reader?.fullName ?? "")}</td>
                <td>${escapeHtml(x.reader?.className ?? "")}</td>
                <td>${pill(String(x.count), "warn")}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>`
          : `<p class="muted">Không có độc giả nợ sách.</p>`
      }
      <div class="divider"></div>
      <div class="alert info">
        <div><b>Gợi ý</b>: Muốn có dữ liệu, hãy tạo phiếu mượn ở tab <b>Mượn sách</b> và chưa trả.</div>
      </div>
    `;
  }

  // ---------- AI Recommend (RAG mini) ----------

  function inferReaderMajor(reader, loans, copies, titles) {
    const majorCount = new Map();
    loans
      .filter((l) => l.readerId === reader.readerId)
      .forEach((l) => {
        const c = copies.find((x) => x.copyId === l.copyId);
        const t = titles.find((x) => x.titleId === c?.titleId);
        if (!t?.majorId) return;
        majorCount.set(t.majorId, (majorCount.get(t.majorId) ?? 0) + 1);
      });
    if (majorCount.size) {
      return [...majorCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    const cls = (reader.className || "").toLowerCase();
    if (cls.startsWith("ct")) return "CN001";
    if (cls.startsWith("kt")) return "CN002";
    return null;
  }

  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 3);
  }

  function computeRecommendations(reader, interestText, { loans, copies, titles }) {
    const inferredMajor = inferReaderMajor(reader, loans, copies, titles);
    const interestTokens = tokenize(interestText);
    const seenTitleIds = new Set(
      loans
        .filter((l) => l.readerId === reader.readerId)
        .map((l) => {
          const c = copies.find((x) => x.copyId === l.copyId);
          return c?.titleId;
        })
        .filter(Boolean)
    );

    const recs = titles.map((t) => {
      let score = 0;
      const reasons = [];

      if (inferredMajor && t.majorId === inferredMajor) {
        score += 3;
        reasons.push("Cùng chuyên ngành với lịch sử học tập/mượn của độc giả");
      }

      const sameMajorLoans = loans.filter((l) => {
        const c = copies.find((x) => x.copyId === l.copyId);
        const tt = titles.find((x2) => x2.titleId === c?.titleId);
        return l.readerId === reader.readerId && tt?.majorId === t.majorId;
      }).length;
      if (sameMajorLoans > 0) {
        score += Math.min(2, sameMajorLoans * 0.5);
        reasons.push("Độc giả từng mượn sách cùng chuyên ngành");
      }

      if (interestTokens.length) {
        const corpus = [
          t.name || "",
          t.author || "",
          t.publisher || "",
          (Array.isArray(t.tags) ? t.tags.join(" ") : t.tags || ""),
        ]
          .join(" ")
          .toLowerCase();
        const matchTokens = interestTokens.filter((w) => corpus.includes(w));
        if (matchTokens.length) {
          score += matchTokens.length * 1.2;
          reasons.push(`Khớp từ khóa quan tâm: ${matchTokens.join(", ")}`);
        }
      }

      if (seenTitleIds.has(t.titleId)) {
        score += 0.5;
        reasons.push("Độc giả đã từng tiếp cận đầu sách này");
      }

      return { title: t, score, reasons };
    });

    recs.sort((a, b) => b.score - a.score);
    const maxScore = recs[0]?.score ?? 0;
    const results =
      maxScore > 0
        ? recs.filter((r) => r.score > 0 && r.score >= maxScore * 0.4).slice(0, 8)
        : recs
            .filter((r) => !inferredMajor || r.title.majorId === inferredMajor)
            .slice(0, 5);

    return { inferredMajor, results };
  }

  function renderAiRecommend({ leftEl, rightEl }) {
    const readers = Store().load(Store().KEYS.readers, []);
    const loans = Store().load(Store().KEYS.loans, []);
    const copies = Store().load(Store().KEYS.copies, []);
    const titles = Store().load(Store().KEYS.titles, []);

    leftEl.innerHTML = `
      <h2 class="h2">Gợi ý sách (RAG AI mini)</h2>
      <p class="muted small">
        Mô-đun này mô phỏng <b>RAG (Retrieval-Augmented Generation)</b> đơn giản:
        truy hồi đầu sách theo <i>chuyên ngành + lịch sử mượn + từ khóa quan tâm</i>,
        sau đó sinh lý do gợi ý.
      </p>
      <div class="divider"></div>
      <form id="aiForm" class="grid gap-10">
        <label class="field">
          <span>Chọn độc giả</span>
          <select name="readerId" required>
            <option value="">-- Chọn độc giả --</option>
            ${readers
              .map(
                (r) =>
                  `<option value="${escapeHtml(r.readerId)}">${escapeHtml(r.fullName)} (${escapeHtml(
                    r.readerId
                  )} - ${escapeHtml(r.className)})</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="field">
          <span>Chủ đề quan tâm / Nhu cầu (ví dụ: "cấu trúc dữ liệu", "kinh tế vi mô", "ôn thi cuối kỳ")</span>
          <textarea name="interest" placeholder="Nhập tiếng Việt hoặc tiếng Anh..."></textarea>
        </label>
        <div class="row gap-10 wrap">
          <button class="btn primary" type="submit">Gợi ý sách</button>
          <button class="btn" type="button" id="aiExampleBtn">Tự động điền ví dụ</button>
        </div>
      </form>
    `;

    rightEl.innerHTML = `
      <h2 class="h2">Kết quả gợi ý</h2>
      <p class="muted small">
        Chọn độc giả và nhập nhu cầu, hệ thống sẽ xếp hạng đầu sách phù hợp và giải thích vì sao gợi ý.
      </p>
    `;

    const form = leftEl.querySelector("#aiForm");
    const exBtn = leftEl.querySelector("#aiExampleBtn");

    exBtn.addEventListener("click", () => {
      if (!readers.length) return;
      const r = readers[0];
      form.readerId.value = r.readerId;
      form.interest.value = "cấu trúc dữ liệu, giải thuật, ôn thi cuối kỳ";
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const readerId = String(fd.get("readerId") ?? "").trim();
      const interest = String(fd.get("interest") ?? "").trim();
      const reader = readers.find((r) => r.readerId === readerId);
      if (!reader) return;

      const { inferredMajor, results } = computeRecommendations(reader, interest, { loans, copies, titles });

      if (!results.length) {
        rightEl.innerHTML = `
          <h2 class="h2">Kết quả gợi ý</h2>
          <p class="muted">Chưa có gợi ý phù hợp. Hãy thử mở rộng chủ đề quan tâm hoặc thêm đầu sách vào hệ thống.</p>
        `;
        return;
      }

      const infoMajor = inferredMajor
        ? `<div class="muted small">Chuyên ngành suy luận: <code>${escapeHtml(inferredMajor)}</code></div>`
        : `<div class="muted small">Chưa suy luận được chuyên ngành rõ ràng (ít lịch sử mượn / tên lớp không rõ).</div>`;

      rightEl.innerHTML = `
        <h2 class="h2">Kết quả gợi ý cho ${escapeHtml(reader.fullName)} (${escapeHtml(reader.readerId)})</h2>
        ${infoMajor}
        <div class="divider"></div>
        <table class="table">
          <thead>
            <tr>
              <th>Hạng</th>
              <th>Đầu sách</th>
              <th>Tác giả</th>
              <th>Chuyên ngành</th>
              <th>Điểm phù hợp</th>
              <th>Giải thích (AI)</th>
            </tr>
          </thead>
          <tbody>
            ${results
              .map((r, idx) => {
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${escapeHtml(r.title.name)} <span class="muted small">(${escapeHtml(r.title.titleId)})</span></td>
                    <td>${escapeHtml(r.title.author || "")}</td>
                    <td><code>${escapeHtml(r.title.majorId || "")}</code></td>
                    <td>${pill(r.score.toFixed(1), "ok")}</td>
                    <td class="small">${r.reasons.map((rs) => `- ${escapeHtml(rs)}`).join("<br/>")}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      `;
    });
  }

  function renderAdmin({ leftEl, rightEl, query }) {
    const me = getWhoAmI();
    if (!me || me.role !== ROLES.ADMIN) {
      leftEl.innerHTML = `<h2 class="h2">Quản trị người dùng</h2><p class="muted">Bạn không có quyền truy cập.</p>`;
      rightEl.innerHTML = ``;
      return;
    }

    const staff = Store().load(Store().KEYS.staff, []);
    const users = Store().load(Store().KEYS.users, []);

    const filteredStaff = query ? staff.filter((s) => `${s.staffId} ${s.fullName}`.toLowerCase().includes(query)) : staff;
    const filteredUsers = query ? users.filter((u) => `${u.username} ${u.role} ${u.staffId}`.toLowerCase().includes(query)) : users;

    leftEl.innerHTML = `
      <h2 class="h2">Nhân viên (thủ thư)</h2>
      <form id="staffForm" class="grid gap-10">
        <div class="grid cols-2 gap-10">
          <label class="field"><span>Mã nhân viên</span><input name="staffId" placeholder="NV00003" /></label>
          <label class="field"><span>Họ tên</span><input name="fullName" required /></label>
        </div>
        <label class="field">
          <span>Trạng thái</span>
          <select name="status" required>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
        <div class="row gap-10 wrap">
          <button class="btn primary" type="submit">Lưu</button>
          <button class="btn" type="button" id="staffClearBtn">Làm mới</button>
        </div>
        <div id="staffErr" class="alert danger hidden"></div>
      </form>
    `;

    rightEl.innerHTML = `
      <h2 class="h2">Tài khoản & phân quyền</h2>
      <form id="userForm" class="grid gap-10">
        <div class="grid cols-2 gap-10">
          <label class="field"><span>Username</span><input name="username" placeholder="newuser" /></label>
          <label class="field"><span>Password</span><input name="password" type="password" placeholder="******" /></label>
        </div>
        <div class="grid cols-2 gap-10">
          <label class="field">
            <span>Gắn với nhân viên</span>
            <select name="staffId" required>
              ${staff.map((s) => `<option value="${escapeHtml(s.staffId)}">${escapeHtml(s.fullName)} (${escapeHtml(s.staffId)})</option>`).join("")}
            </select>
          </label>
          <label class="field">
            <span>Vai trò</span>
            <select name="role" required>
              <option value="LIBRARIAN">LIBRARIAN</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span>Trạng thái</span>
          <select name="active" required>
            <option value="true">ACTIVE</option>
            <option value="false">LOCKED</option>
          </select>
        </label>
        <div class="row gap-10 wrap">
          <button class="btn primary" type="submit">Lưu</button>
          <button class="btn" type="button" id="userClearBtn">Làm mới</button>
        </div>
        <div id="userErr" class="alert danger hidden"></div>
      </form>

      <div class="divider"></div>
      <div class="grid cols-2 gap-14">
        <section>
          <h2 class="h2">Danh sách nhân viên</h2>
          ${filteredStaff.length ? renderStaffTable(filteredStaff, users) : `<p class="muted">Không có dữ liệu.</p>`}
        </section>
        <section>
          <h2 class="h2">Danh sách tài khoản</h2>
          ${filteredUsers.length ? renderUsersTable(filteredUsers, staff) : `<p class="muted">Không có dữ liệu.</p>`}
        </section>
      </div>
    `;

    // Bind forms
    const staffForm = leftEl.querySelector("#staffForm");
    const staffErr = leftEl.querySelector("#staffErr");
    leftEl.querySelector("#staffClearBtn").addEventListener("click", () => {
      staffForm.reset();
      staffForm.staffId.value = "";
      staffErr.classList.add("hidden");
    });
    staffForm.addEventListener("submit", (e) => {
      e.preventDefault();
      staffErr.classList.add("hidden");
      const fd = new FormData(staffForm);
      const staffId = String(fd.get("staffId") ?? "").trim() || Store().nextId("staff", "NV");
      const fullName = String(fd.get("fullName") ?? "").trim();
      const status = String(fd.get("status") ?? "ACTIVE").trim();
      const all = Store().load(Store().KEYS.staff, []);
      const existed = all.find((x) => x.staffId === staffId);
      if (existed) Object.assign(existed, { fullName, status });
      else all.push({ staffId, fullName, status });
      Store().save(Store().KEYS.staff, all);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    const userForm = rightEl.querySelector("#userForm");
    const userErr = rightEl.querySelector("#userErr");
    rightEl.querySelector("#userClearBtn").addEventListener("click", () => {
      userForm.reset();
      userForm.username.value = "";
      userForm.password.value = "";
      userErr.classList.add("hidden");
    });
    userForm.addEventListener("submit", (e) => {
      e.preventDefault();
      userErr.classList.add("hidden");
      const fd = new FormData(userForm);
      const username = String(fd.get("username") ?? "").trim();
      const password = String(fd.get("password") ?? "");
      const staffId = String(fd.get("staffId") ?? "").trim();
      const role = String(fd.get("role") ?? "LIBRARIAN").trim();
      const active = String(fd.get("active") ?? "true") === "true";
      if (!username) {
        userErr.textContent = "Username không được rỗng.";
        userErr.classList.remove("hidden");
        return;
      }
      const all = Store().load(Store().KEYS.users, []);
      const existed = all.find((x) => x.username === username);
      if (!existed && all.some((x) => x.username === username)) {
        userErr.textContent = "Username đã tồn tại.";
        userErr.classList.remove("hidden");
        return;
      }
      const payload = { username, password: password || existed?.password || "changeme", role, staffId, active };
      if (existed) Object.assign(existed, payload);
      else all.push(payload);
      Store().save(Store().KEYS.users, all);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    // bind staff table actions
    rightEl.querySelectorAll('button[data-act="editStaff"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const all = Store().load(Store().KEYS.staff, []);
        const s = all.find((x) => x.staffId === id);
        const form = leftEl.querySelector("#staffForm");
        if (!s || !form) return;
        form.staffId.value = s.staffId;
        form.fullName.value = s.fullName;
        form.status.value = s.status;
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    rightEl.querySelectorAll('button[data-act="delStaff"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const staffAll = Store().load(Store().KEYS.staff, []);
        const usersAll = Store().load(Store().KEYS.users, []);
        const used = usersAll.some((u) => u.staffId === id);
        if (used) {
          alert("Không thể xóa nhân viên khi đang có tài khoản gắn kèm. Hãy xóa/sửa tài khoản trước.");
          return;
        }
        if (!confirm(`Xóa nhân viên ${id}?`)) return;
        Store().save(Store().KEYS.staff, staffAll.filter((x) => x.staffId !== id));
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
    });

    // bind user table actions
    rightEl.querySelectorAll('button[data-act="editUser"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const usersAll = Store().load(Store().KEYS.users, []);
        const u = usersAll.find((x) => x.username === id);
        const form = rightEl.querySelector("#userForm");
        if (!u || !form) return;
        form.username.value = u.username;
        form.password.value = "";
        form.staffId.value = u.staffId;
        form.role.value = u.role;
        form.active.value = u.active ? "true" : "false";
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    rightEl.querySelectorAll('button[data-act="delUser"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (id === "admin") {
          alert("Không cho xóa tài khoản admin demo.");
          return;
        }
        const usersAll = Store().load(Store().KEYS.users, []);
        if (!confirm(`Xóa tài khoản ${id}?`)) return;
        Store().save(Store().KEYS.users, usersAll.filter((x) => x.username !== id));
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
    });
  }

  function renderStaffTable(staff, users) {
    const userByStaff = new Map();
    users.forEach((u) => userByStaff.set(u.staffId, u));
    return `
      <table class="table">
        <thead><tr><th>Mã</th><th>Họ tên</th><th>Trạng thái</th><th>Tài khoản</th><th>Thao tác</th></tr></thead>
        <tbody>
          ${staff
            .map((s) => {
              const u = userByStaff.get(s.staffId);
              return `
                <tr>
                  <td><code>${escapeHtml(s.staffId)}</code></td>
                  <td>${escapeHtml(s.fullName)}</td>
                  <td>${s.status === "ACTIVE" ? pill("ACTIVE", "ok") : pill("INACTIVE", "bad")}</td>
                  <td>${u ? `<code>${escapeHtml(u.username)}</code> <span class="muted small">(${escapeHtml(u.role)})</span>` : `<span class="muted">-</span>`}</td>
                  <td class="row gap-10 wrap">
                    <button class="btn" data-act="editStaff" data-id="${escapeHtml(s.staffId)}">Sửa</button>
                    <button class="btn danger" data-act="delStaff" data-id="${escapeHtml(s.staffId)}">Xóa</button>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderUsersTable(users, staff) {
    const staffById = new Map(staff.map((s) => [s.staffId, s]));
    return `
      <table class="table">
        <thead><tr><th>Username</th><th>Vai trò</th><th>Nhân viên</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>
          ${users
            .map((u) => {
              const s = staffById.get(u.staffId);
              return `
                <tr>
                  <td><code>${escapeHtml(u.username)}</code></td>
                  <td>${escapeHtml(u.role)}</td>
                  <td>${escapeHtml(s?.fullName ?? "")} <span class="muted small">(${escapeHtml(u.staffId)})</span></td>
                  <td>${u.active ? pill("ACTIVE", "ok") : pill("LOCKED", "bad")}</td>
                  <td class="row gap-10 wrap">
                    <button class="btn" data-act="editUser" data-id="${escapeHtml(u.username)}">Sửa</button>
                    <button class="btn danger" data-act="delUser" data-id="${escapeHtml(u.username)}">Xóa</button>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    `;
  }

  window.LibraryApp = {
    init,
    requireLoggedIn,
    requireLoggedOut,
    bindLogin,
    mountApp,
  };
})();

