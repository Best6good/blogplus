/**
 * 学习随录 — 完整交互脚本
 * 包含：主题切换、滚动动画、API数据加载、弹窗交互
 */

(function () {
  'use strict';

  // ========== 配置 ==========
  // 后端服务地址（改动端口时同步修改这里）
  const BACKEND_ORIGIN = 'http://localhost:3001';

  // 自动识别接口地址：
  // - 由后端自身提供页面（localhost:3001）→ 使用相对路径 /api（同源）
  // - 直接双击 index.html（file://）或用 Live Server 等其他端口打开 → 指向后端服务
  const API_BASE = (function resolveApiBase() {
    const { protocol, hostname, port } = window.location;
    if (protocol === 'file:') return `${BACKEND_ORIGIN}/api`;

    const localHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];
    if (localHosts.indexOf(hostname) !== -1) {
      return port === '3001' ? '/api' : `${BACKEND_ORIGIN}/api`;
    }
    return '/api';
  })();

  // ========== DOM 元素 ==========
  const html = document.documentElement;
  const themeToggle = document.getElementById('themeToggle');
  const header = document.querySelector('.site-header');
  const notesGrid = document.getElementById('notes-grid');
  const projectsGrid = document.getElementById('projects-grid');
  const statNotes = document.getElementById('stat-notes');
  const statProjects = document.getElementById('stat-projects');
  const statTags = document.getElementById('stat-tags');
  const contactBtn = document.getElementById('contact-btn');
  const githubBtn = document.getElementById('github-btn');
  const avatarInitial = document.getElementById('avatar-initial');

  // 弹窗元素
  const noteModal = document.getElementById('note-modal');
  const projectModal = document.getElementById('project-modal');
  const contactModal = document.getElementById('contact-modal');
  const toast = document.getElementById('toast');

  // 全局数据缓存
  let notesList = [];
  let projectsList = [];
  let currentNoteIndex = 0;
  let currentProjectId = null;

  // ========== 工具函数 ==========

  // 格式化日期
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  }

  // HTML 转义：渲染用户可控文本前调用，防 XSS
  function escapeHTML(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 简单的 Markdown 转 HTML
  function simpleMarkdownToHTML(text) {
    if (!text) return '';
    // 先整体转义，再渲染 Markdown 标记，避免注入 HTML/脚本
    let html = escapeHTML(text)
      // 标题
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      // 代码块
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      // 行内代码
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // 粗体
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // 段落
      .replace(/\n\n/g, '</p><p>')
      // 列表
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/<\/ul>\n<ul>/g, '');
    
    // 首尾添加段落标签
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }
    // 修正开头
    html = html.replace(/^(<h[23]>)/, '</p>$1');
    html = html.replace(/(<\/(h[23]|pre|ul)>)(?=\n?[^<])/g, '$1<p>');
    
    return html;
  }

  // Toast 提示
  function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // 数字动画（柔和版）
  // - 起始值 = max(0, target - 6)：视觉上接近目标，避免从 0 暴跳
  // - duration 1800ms（更慢更优雅）
  // - ease-out quart（4 次方，末尾曲线更平缓）
  // - data-animated 防重复触发
  function animateNumber(element, target, duration = 1800) {
    if (!element) return;
    if (element.dataset.animated === '1') return;     // 只做一次
    element.dataset.animated = '1';

    const start = Math.max(0, target - 6);            // 接近目标的小幅递增
    const startTime = performance.now();

    // 立即同步起始值（避免显示 HTML 默认的 "0" 闪一下）
    element.textContent = start;

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quart：开始变化快，末段非常柔和
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(start + (target - start) * easeProgress);
      element.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        // 收尾：确保最终值精确
        element.textContent = target;
      }
    }

    requestAnimationFrame(update);
  }

  // ========== API 请求 ==========

  async function apiFetch(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error('API 返回内容不是 JSON:', text.slice(0, 200));
        return { success: false, message: `接口返回异常（HTTP ${response.status}）` };
      }

      if (!response.ok) {
        return { success: false, message: data.message || `请求失败（HTTP ${response.status}）` };
      }

      return data;
    } catch (error) {
      console.error('API 请求失败:', error);
      return { success: false, message: `无法连接到后端服务（${API_BASE}）` };
    }
  }

  // 渲染加载失败状态（带重试按钮）
  function renderLoadError(container, name, retry) {
    container.innerHTML = `
      <div class="empty-state">
        <p>${name}加载失败</p>
        <p style="margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.8;">
          请确认后端服务已启动，并访问 http://localhost:3001
        </p>
        <button type="button" class="btn btn-secondary retry-btn" style="margin-top: 1rem;">点击重试</button>
      </div>
    `;
    const btn = container.querySelector('.retry-btn');
    if (btn) btn.addEventListener('click', retry);
  }

  // ========== 主题切换 ==========

  function getInitialTheme() {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme, animate) {
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }

  applyTheme(getInitialTheme(), false);

  let themeAnimating = false;

  if (themeToggle) {
    themeToggle.addEventListener('click', (event) => {
      if (themeAnimating) return;
      themeAnimating = true;

      const rect = themeToggle.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const isDark = html.classList.contains('dark');
      const targetTheme = isDark ? 'light' : 'dark';
      const revealColor = targetTheme === 'dark' ? '#1a1a1f' : '#ffffff';
      const revealColorSoft = targetTheme === 'dark' ? '#2d2d35' : '#e8e8ed';

      const reveal = document.createElement('span');
      reveal.className = 'theme-reveal expanding';
      reveal.style.setProperty('--reveal-x', `${x}px`);
      reveal.style.setProperty('--reveal-y', `${y}px`);
      reveal.style.setProperty('--reveal-color', revealColor);
      reveal.style.setProperty('--reveal-color-soft', revealColorSoft);
      reveal.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(reveal, document.body.firstChild);

      window.setTimeout(() => {
        applyTheme(targetTheme, true);
      }, 550);

      window.setTimeout(() => {
        reveal.remove();
        themeAnimating = false;
      }, 1100);
    });
  }

  // ========== 导航栏滚动阴影 ==========

  function updateHeader() {
    if (!header) return;
    if (window.scrollY > 10) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', updateHeader, { passive: true });
  updateHeader();

  // ========== 滚动入场动画 ==========

  function initReveal() {
    const revealElements = document.querySelectorAll(
      '.hero-content, .hero-stats, .section-header, .about-card'
    );

    if (!('IntersectionObserver' in window)) {
      revealElements.forEach((el) => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    revealElements.forEach((el, index) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${index * 0.05}s`;
      observer.observe(el);
    });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(initReveal);
  } else {
    initReveal();
  }

  // ========== 弹窗控制 ==========

  function openModal(modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // 关闭按钮
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) closeModal(modal);
    });
  });

  // 点击遮罩关闭
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });

  // ESC 键关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(modal => {
        closeModal(modal);
      });
    }
  });

  // ========== 笔记相关 ==========

  // 渲染笔记卡片
  function renderNoteCard(note, index) {
    const delay = 0.15 + index * 0.05;
    return `
      <article class="note-card reveal" style="transition-delay: ${delay}s;" data-id="${note.id}">
        <div class="note-meta">
          <time datetime="${note.created_at}">${formatDate(note.created_at)}</time>
          <span class="tag">${escapeHTML(note.tag) || '未分类'}</span>
        </div>
        <h3 class="note-title">${escapeHTML(note.title)}</h3>
        <p class="note-excerpt">${escapeHTML(note.excerpt)}</p>
        <a href="#" class="note-link" onclick="event.preventDefault()">阅读全文 <span aria-hidden="true">→</span></a>
      </article>
    `;
  }

  // 加载笔记列表
  async function loadNotes() {
    if (!notesGrid) return;
    
    notesGrid.innerHTML = '<div class="loading-state">加载笔记中...</div>';
    
    const result = await apiFetch('/notes?limit=8');
    
    if (result.success && result.data) {
      notesList = result.data.list;
      
      if (notesList.length === 0) {
        notesGrid.innerHTML = '<div class="empty-state">暂无笔记</div>';
        return;
      }
      
      notesGrid.innerHTML = notesList.map((note, index) => renderNoteCard(note, index)).join('');
      
      // 绑定点击事件
      notesGrid.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = parseInt(card.dataset.id);
          openNoteDetail(id);
        });
      });
      
      // 触发入场动画
      setTimeout(() => {
        const cards = notesGrid.querySelectorAll('.note-card');
        cards.forEach(card => card.classList.add('visible'));
      }, 50);
    } else {
      renderLoadError(notesGrid, '笔记', loadNotes);
    }
  }

  // 打开笔记详情（?inc=1 让后端累计浏览量）
  async function openNoteDetail(id) {
    const result = await apiFetch(`/notes/${id}?inc=1`);
    
    if (!result.success) {
      showToast('加载笔记失败', 'error');
      return;
    }
    
    const { note, prev, next } = result.data;
    currentNoteIndex = notesList.findIndex(n => n.id === id);
    
    // 填充内容
    document.getElementById('note-modal-title').textContent = note.title;
    document.getElementById('note-modal-date').textContent = formatDate(note.created_at);
    document.getElementById('note-modal-date').setAttribute('datetime', note.created_at);
    document.getElementById('note-modal-tag').textContent = note.tag || '未分类';
    document.getElementById('note-modal-content').innerHTML = simpleMarkdownToHTML(note.content);
    
    // 上下篇按钮
    const prevBtn = document.getElementById('note-prev-btn');
    const nextBtn = document.getElementById('note-next-btn');
    
    if (prev) {
      prevBtn.disabled = false;
      prevBtn.onclick = () => openNoteDetail(prev.id);
    } else {
      prevBtn.disabled = true;
      prevBtn.onclick = null;
    }
    
    if (next) {
      nextBtn.disabled = false;
      nextBtn.onclick = () => openNoteDetail(next.id);
    } else {
      nextBtn.disabled = true;
      nextBtn.onclick = null;
    }
    
    openModal(noteModal);
  }

  // ========== 项目相关 ==========

  // ========== 项目预览：展示动画 + 手动关键词 ==========
  // visual_type 决定展示风格：auto / carousel / dial / marquee / wave
  // （solo / duo 由 auto 模式按关键词个数派生，不作为独立选项）
  // 关键词由后台管理手动填写（空格分隔），存入 project.visual_keywords；
  // 玻璃质感、入场柔和、轮播焦点由 styles.css 统一控制。
  // auto 模式下，前端根据关键词个数自动选择最合适的动画。

  // 旧 visual_type → 新 variant 映射（数据兼容）
  const LEGACY_VARIANT_MAP = {
    cascade: 'auto',
    cluster: 'dial',
    flow:    'marquee',
    stack:   'carousel',
    default: 'auto'
  };

  const VALID_VARIANTS = ['auto', 'carousel', 'dial', 'marquee', 'wave'];

  // 根据关键词个数自动选择最合适的动画
  function pickAutoVariant(count) {
    if (count <= 0) return 'carousel';
    if (count === 1) return 'solo';   // 1 个：solo（居中呼吸）
    if (count === 2) return 'duo';    // 2 个：duo（左右对比）
    if (count === 3) return 'wave';   // 3 个：wave（水平波浪）
    if (count === 4) return 'wave';   // 4 个：wave（水平波浪）
    return 'carousel';                  // ≥5 个：carousel（滚筒循环）
  }

  // 各变体的字号阶梯（rem）
  // 各变体的「基准字号」（rem）——取首项作为该变体的统一字号，
  // 同一变体内的所有关键词字号一致（见 getProjectVisualHTML：不再按序号递减）。
  // 少词/短词时字大而清楚；词数 ≥4 或词偏长时由 countScale/lenScale 整体微收。
  const VARIANT_SIZES = {
    carousel:     [1.6, 1.6, 1.6, 1.6, 1.6],
    dial:         [1.0, 1.0, 1.0, 1.0, 1.0],
    marquee:      [1.05, 1.05, 1.05, 1.05, 1.05],
    wave:         [1.32, 1.32, 1.32, 1.32, 1.32],
    solo:         [1.55, 1.55, 1.55, 1.55, 1.55],
    duo:          [1.38, 1.38, 1.38, 1.38, 1.38]
  };

  // 生成单个关键词 span（--kw-i 控制入场与轮播的相位）
  function kwSpan(word, sizeRem, idx) {
    const safe = String(word).replace(/[<>]/g, ch => (ch === '<' ? '‹' : '›'));
    return `<span class="preview-keyword" style="font-size:${sizeRem}rem;--kw-i:${idx}">${safe}</span>`;
  }

  // ========== dial 环形表盘：动态 N 段停顿旋转（段数 = 关键词数）==========
  // N 个关键词 → 360° 均匀分成 N 份（每份 360/N°），指针“扫一段 → 停顿指向下一个”
  // 每段 1.6s（扫 ~0.32s + 停顿 ~1.28s），总周期 = N × 1.6s，节奏恒定
  // 停顿时被指向的关键词变彩色（delay = 段时长 × idx 与指针到达时刻同步）
  const DIAL_SEG_DUR = 1.6;        // 每段时长（s）
  const dialInjected = {};         // 已注入的 N（去重）

  // 表盘字号：关键词越少字号越大（看得清）、越多越小（避免拥挤），但不过大不过小
  function dialFontSize(n) {
    return Math.max(0.92, Math.min(1.28, 1.28 - (n - 1) * 0.05));
  }

  // 依据关键词个数动态注入一组专属 keyframes + 选择器规则
  function ensureDialStyle(count) {
    const n = Math.max(1, Math.min(count | 0, 8));
    if (!n || dialInjected[n]) return;
    dialInjected[n] = true;

    const segDeg = +(360 / n).toFixed(3);      // 单段角度
    const seg    = 100 / n;                     // 单段占周期百分比
    const dur    = +(n * DIAL_SEG_DUR).toFixed(2); // 动画总时长（s）
    const R      = (x) => +x.toFixed(3);        // 百分比取整

    // 指针关键帧：段内 0-80% 停顿在当前位，80-100% 扫到下一位置
    // 0% = rotate(0deg) 与 100% = rotate(360deg) 数值无缝衔接（循环）
    const ptr = [`@keyframes kw-dial-ptr-${n} {`];
    ptr.push(`  0%   { transform: translate3d(-50%, -100%, 0) rotate(0deg); }`);
    for (let i = 0; i < n; i++) {
      const stop   = R(i * seg + seg * 0.8);       // 停顿结束（本段 80% 处）
      const arrive = R((i + 1) * seg);             // 到达下一个关键词（段末）
      ptr.push(
        `  ${stop}%   { transform: translate3d(-50%, -100%, 0) rotate(${R(i * segDeg)}deg); animation-timing-function: cubic-bezier(0.3, 0.75, 0.35, 1); }`,
        `  ${arrive}% { transform: translate3d(-50%, -100%, 0) rotate(${R((i + 1) * segDeg)}deg); }`
      );
    }
    ptr.push('}');

    // 彩色关键帧：保持“当前 + 前一个”两个彩色，更早的必然退黑。
    // 时间轴（以 span 自身动画计，delay = 段时长×idx 对齐指针到达时刻）：
    //   phase 0 → seg×1.7% 全彩（≈1.7 段 = 2.72s）
    //   seg×1.7 → seg×1.9% 渐退（0.32s 柔和过渡）
    //   seg×1.9 → 100% 完全黑色（全黑点 = delay+1.9seg < 第 3 段起点，指针指到第 3 个词时前一个必已全黑）
    const colKeep  = R(Math.min(seg * 1.7, 100));
    const colBlack = R(Math.min(seg * 1.9, 100));
    const col = [
      `@keyframes kw-dial-color-${n} {`,
      `  0%, ${colKeep}% {`,
      `    color: transparent;`,
      `    background: linear-gradient(135deg, #82b1ff 0%, #b388ff 50%, #ff7eb6 100%);`,
      `    -webkit-background-clip: text;`,
      `    background-clip: text;`,
      `    filter: none;`,
      `    opacity: 1;`,
      `    font-weight: 700;`,
      `  }`,
      `  ${colBlack}%, 100% {`,
      `    color: var(--muted-foreground);`,
      `    filter: blur(1px);`,
      `    opacity: 0.55;`,
      `    font-weight: 600;`,
      `  }`,
      '}'
    ];

    const style = document.createElement('style');
    style.id = `dial-kf-${n}`;
    style.textContent = [
      ...ptr,
      ...col,
      `.preview-dial[data-count="${n}"] .preview-words::after {`,
      `  animation: kw-dial-ptr-${n} ${dur}s linear infinite;`,
      `}`,
      `.preview-dial[data-count="${n}"] .preview-keyword {`,
      `  animation: kw-fade-in 0.85s var(--ease-out-expo) both, kw-dial-color-${n} ${dur}s linear infinite;`,
      `  animation-delay: calc(var(--kw-i, 0) * 0.18s), calc(${DIAL_SEG_DUR}s * var(--kw-i, 0));`,
      `}`
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  // ========== carousel 堆叠轮播：三槽推挤（前一个 | 正在展示 | 后一个） ==========
  // 关键：每个关键词一个循环 = N 拍（周期 N×2.6s，随词数增长），词 i 起点 = 2.6s×(i-1)
  //   → 任意词数都精确错开一拍，绝不会有两个词挤到同一相位（此前固定 3 拍周期，
  //     词数>3 时会撞相位 → 画面叠成一堆）。第 N 词左槽淡出帧与第 1 词右槽浮现无缝衔接。
  const CAR_SEG_DUR = 2.6;          // 每拍时长（右槽→中央→左槽）
  const carouselInjected = {};       // 已注入的 N（去重）

  function ensureCarouselStyle(count) {
    const n = Math.max(2, Math.min(count | 0, 8));
    if (n < 2 || carouselInjected[n]) return;
    carouselInjected[n] = true;

    const dur = +(n * CAR_SEG_DUR).toFixed(2);  // 每个词自己的完整循环时长
    const u   = 100 / n;                          // 一拍占循环的百分比
    const R   = (x) => +x.toFixed(3);

    // 三种字形状态：c=彩色·顶层；d=退场中彩色淡影·降层+轻雾(给新词让路)；g=灰/模糊·低层
    const colC = 'color:transparent;background:linear-gradient(135deg,#82b1ff 0%,#b388ff 50%,#ff7eb6 100%);-webkit-background-clip:text;background-clip:text;filter:none;font-weight:700;z-index:2;';
    const colD = 'color:transparent;background:linear-gradient(135deg,#82b1ff 0%,#b388ff 50%,#ff7eb6 100%);-webkit-background-clip:text;background-clip:text;filter:blur(1.5px);font-weight:700;z-index:1;';
    // 所有非彩色(非主要展示)关键词统一明显的模糊，弱化存在感
    const colG = 'color:var(--muted-foreground);filter:blur(2px);font-weight:600;z-index:1;';
    const cssOf = (m) => (m === 'c' ? colC : m === 'd' ? colD : colG);

    const frames = [];
    const add = (p, x, s, o, mode, glide) => frames.push([p, x, s, o, mode, glide]);
    // 接近用单一正弦缓入缓出（尾速归零不“顿”）。关键：旧词“变模糊/降层”的起点
    // 与下一个词“变清晰”的起点几乎同刻——旧词在新词渐亮的窗口内同步模糊淡出让位，
    // 形成连续交叉渐变，而不是“先退完再进”的一顿一顿。
    add(0,             190, 0.6,  0,    'g', false);
    add(R(u * 0.16),   150, 0.62, 0.5,  'g', false);   // 右槽淡入候场
    add(R(u * 0.4),    106, 0.74, 0.56, 'g', true);    // 缓启动开始滑近
    add(u,             0,   1.14, 0.55, 'c', true);    // 单一长程：柔和接近到位+放大+彩色半透明
    add(R(u * 1.25),   0,   1.14, 1,    'c', false);   // 彩色逐渐亮满（更大字）
    add(R(u * 1.85),   0,   1.13, 1,    'c', false);   // 中央清晰展示保持（顶层，几乎占满一拍）
    add(R(u * 1.98),  -6,   1.12, 1,    'd', false);   // 下一词开始变清晰的同刻：本词降层+轻雾
    add(R(u * 2.2),  -70,   0.95, 0.35, 'd', false);   // 交叉窗口内连续渐隐让位
    add(R(u * 2.45), -150,  0.75, 0,    'd', false);   // 淡出完成（p>100 自动跳过，n=2 由 100 帧承接）
    add(100,         -190,  0.58, 0,    'd', false);

    const keyframes = [`@keyframes kw-carousel-${n} {`];
    for (const [p, x, s, o, mode, glide] of frames) {
      if (p > 100) continue;
      // 正弦缓入缓出：无回弹、尾速归零（落定不“顿”），中段最高速度也较低、更缓慢平滑
      const ease = glide ? ' animation-timing-function:cubic-bezier(0.37,0,0.63,1);' : '';
      keyframes.push(
        `  ${R(p)}% { transform: translate3d(-50%, -50%, 0) translateX(${x}px) scale(${s}); opacity:${o}; ${cssOf(mode)}${ease} }`
      );
    }
    keyframes.push('}');

    const style = document.createElement('style');
    style.id = `carousel-kf-${n}`;
    style.textContent = [
      ...keyframes,
      `.preview-carousel[data-count="${n}"] .preview-keyword {`,
      `  animation: kw-fade-in 0.85s var(--ease-out-expo) both, kw-carousel-${n} ${dur}s linear infinite;`,
      // 负延迟：加载瞬间所有词都已进入循环中各自相位（第 0 词恰好中央变彩），
      // 不会再有词在正延迟等待期"淡入初始槽位"形成右侧排队
      `  animation-delay: calc(var(--kw-i, 0) * 0.18s), calc(-1 * ${CAR_SEG_DUR}s * (var(--kw-i, 0) + 1));`,
      `}`
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  // 生成项目预览区 HTML
  function getProjectVisualHTML(project, featured) {
    const raw = project.visual_type || 'auto';

    // 从后台手动填写的 visual_keywords 按空格分词，最多取 8 个
    const keywords = String(project.visual_keywords || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8);

    // auto 模式下根据关键词个数自动选择最合适动画
    let vt;
    if (raw === 'auto' || !VALID_VARIANTS.includes(raw)) {
      vt = pickAutoVariant(keywords.length);
    } else {
      vt = LEGACY_VARIANT_MAP[raw] || raw;
    }

    // dial：按关键词个数动态注入 N 段停顿旋转动画（每个 dial 卡都会触发）
    // carousel：按关键词个数动态注入“三槽无缝推挤”动画（防 N>3 撞相位）
    if (vt === 'dial') ensureDialStyle(keywords.length);
    if (vt === 'carousel') ensureCarouselStyle(keywords.length);

    const sizes = VARIANT_SIZES[vt] || VARIANT_SIZES.carousel;
    // 弹幕模式字号自适应：关键词个数越多 → 字号越大；越少 → 越小
    // count 1→0.85 / 2→0.95 / 3→1.05 / 4→1.15 / 5→1.25
    // 字长维度：最长关键词越多字，整体再收一点（4 字内不变；5~6 字微收；7 字以上多收）
    const maxKwLen = Math.max.apply(null, keywords.map(w => String(w).length).concat([0]));
    const lenScale = maxKwLen >= 7 ? 0.9 : maxKwLen >= 5 ? 0.95 : 1;

    // 弹幕字号：关键词越少字越大、越多越小（1 → 1.8，6 → ~1.35），下限 1.35 保持醒目
    const marqueeBaseSize =
      Math.max(1.35, Math.min(1.8, 1.8 - (keywords.length - 1) * 0.09)) * lenScale;

    // 同屏并列（wave/duo）或同一展示位置轮换（stack/carousel/solo）的关键词
    // 必须使用「同一字号」，禁止按序号逐个递减，否则会出现词与词之间大小不齐。
    // 仅当总词数多（≥4）或最长词偏长时，用 countScale / lenScale 整体收一点。
    const countScale = keywords.length >= 5 ? 0.9 : keywords.length === 4 ? 0.95 : 1;
    const baseSize = (sizes[0] || 1.0) * countScale * lenScale;

    const keywordsHTML = keywords.map((w, i) => {
      let sizeRem;
      if (vt === 'marquee') sizeRem = marqueeBaseSize;
      else if (vt === 'dial') sizeRem = dialFontSize(keywords.length) * lenScale;
      else sizeRem = baseSize;
      return kwSpan(w, sizeRem, i);
    }).join('');

    return `
        <div class="preview-window preview-${vt}" data-count="${keywords.length}" style="--kw-count:${keywords.length}">
          <div class="preview-words">
            ${keywordsHTML}
          </div>
        </div>
      `;
    }

  // 渲染项目卡片
  function renderProjectCard(project, index, featured) {
    const delay = 0.4 + index * 0.05;
    const tagsHTML = (project.tags || []).map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('');
    
    return `
      <article class="project-card ${featured ? 'featured' : ''} reveal" style="transition-delay: ${delay}s;" data-id="${project.id}">
        <div class="project-visual" aria-hidden="true">
          ${getProjectVisualHTML(project, featured)}
        </div>
        <div class="project-body">
          <div class="project-tags">
            ${tagsHTML}
          </div>
          <h3 class="project-title">${escapeHTML(project.title)}</h3>
          <p class="project-desc">${escapeHTML(project.description)}</p>
          <div class="project-links">
            <a href="#" class="link-primary" onclick="event.preventDefault()">在线预览</a>
            <a href="#" class="link-secondary" onclick="event.preventDefault()">查看源码</a>
          </div>
        </div>
      </article>
    `;
  }

  // 加载项目列表
  async function loadProjects() {
    if (!projectsGrid) return;
    
    projectsGrid.innerHTML = '<div class="loading-state">加载项目中...</div>';
    
    const result = await apiFetch('/projects');
    
    if (result.success && result.data) {
      projectsList = result.data;
      
      if (projectsList.length === 0) {
        projectsGrid.innerHTML = '<div class="empty-state">暂无项目</div>';
        return;
      }
      
      // 分离特色项目和普通项目
      const featuredProjects = projectsList.filter(p => p.featured);
      const normalProjects = projectsList.filter(p => !p.featured);
      
      let html = '';
      let cardIndex = 0;
      
      // 特色项目
      featuredProjects.forEach(project => {
        html += renderProjectCard(project, cardIndex, true);
        cardIndex++;
      });
      
      // 普通项目
      normalProjects.forEach(project => {
        html += renderProjectCard(project, cardIndex, false);
        cardIndex++;
      });
      
      projectsGrid.innerHTML = html;
      
      // 绑定点击事件
      projectsGrid.querySelectorAll('.project-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = parseInt(card.dataset.id);
          openProjectDetail(id);
        });
      });
      
      // 触发入场动画
      setTimeout(() => {
        const cards = projectsGrid.querySelectorAll('.project-card');
        cards.forEach(card => card.classList.add('visible'));
      }, 50);
    } else {
      renderLoadError(projectsGrid, '项目', loadProjects);
    }
  }

  // 打开项目详情（?inc=1 让后端累计浏览量）
  async function openProjectDetail(id) {
    const result = await apiFetch(`/projects/${id}?inc=1`);
    
    if (!result.success) {
      showToast('加载项目详情失败', 'error');
      return;
    }
    
    const { project, prev, next } = result.data;
    currentProjectId = id;
    
    // 填充头部内容
    document.getElementById('project-modal-title').textContent = project.title;
    document.getElementById('project-modal-desc').textContent = project.description;
    document.getElementById('project-modal-date').textContent = formatDate(project.created_at);
    document.getElementById('project-modal-date').setAttribute('datetime', project.created_at);
    // 标签
    const tagsHTML = (project.tags || []).map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('');
    document.getElementById('project-modal-tags').innerHTML = tagsHTML;
    
    // 项目详情内容（Markdown 渲染）
    const contentEl = document.getElementById('project-modal-content');
    let contentHTML = '';
    
    if (project.content) {
      contentHTML = simpleMarkdownToHTML(project.content);
    } else {
      contentHTML = '<p style="color: var(--muted-foreground);">暂无详细介绍</p>';
    }
    
    // 添加项目链接区域
    if (project.preview_url || project.source_url) {
      contentHTML += `
        <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.08); display: flex; gap: 0.75rem; flex-wrap: wrap;">
          ${project.preview_url ? `<a href="${escapeHTML(project.preview_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="height: 42px; padding: 0 1.25rem; font-size: 0.85rem;">在线预览</a>` : ''}
          ${project.source_url ? `<a href="${escapeHTML(project.source_url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" style="height: 42px; padding: 0 1.25rem; font-size: 0.85rem;">查看源码</a>` : ''}
        </div>
      `;
    }
    
    // 暗色模式下的分隔线适配
    if (html.classList.contains('dark')) {
      contentHTML = contentHTML.replace(/border-top: 1px solid rgba\(0,0,0,0\.08\)/g, 'border-top: 1px solid rgba(255,255,255,0.08)');
    }
    
    contentEl.innerHTML = contentHTML;
    
    // 上下个项目导航
    const prevBtn = document.getElementById('project-prev-btn');
    const nextBtn = document.getElementById('project-next-btn');
    
    if (prev) {
      prevBtn.disabled = false;
      prevBtn.onclick = () => openProjectDetail(prev.id);
    } else {
      prevBtn.disabled = true;
      prevBtn.onclick = null;
    }
    
    if (next) {
      nextBtn.disabled = false;
      nextBtn.onclick = () => openProjectDetail(next.id);
    } else {
      nextBtn.disabled = true;
      nextBtn.onclick = null;
    }
    
    openModal(projectModal);
  }

  // ========== 统计数据 ==========

  async function loadStats() {
    const result = await apiFetch('/stats');
    
    if (result.success && result.data) {
      animateNumber(statNotes, result.data.notes);
      animateNumber(statProjects, result.data.projects);
      animateNumber(statTags, result.data.tags);
    }
  }

  // ========== 关于我 ==========

  async function loadAbout() {
    const result = await apiFetch('/about');
    
    if (result.success && result.data) {
      const about = result.data;
      
      // 头像文字：优先 avatar_text，其次取名称首字，最终兜底默认「学」
      const markText = String(about.avatar_text || '').trim()
        || String(about.name || '').trim().slice(0, 1)
        || '学';
      const displayName = String(about.name || '').trim() || '学习随录';

      // 更新“关于我”区的头像文字
      if (avatarInitial) {
        avatarInitial.textContent = markText;
      }
      // 同步左上角品牌：头像文字 + 站点名称跟随“关于我”配置
      const brandMark = document.querySelector('.site-header .brand-mark');
      const brandName = document.querySelector('.site-header .brand-name');
      if (brandMark) brandMark.textContent = markText;
      if (brandName) brandName.textContent = displayName;
      
      // 更新 GitHub 链接
      if (about.github && githubBtn) {
        githubBtn.href = about.github;
      }
      
      // 更新关于我正文：简介支持用空行分段，依次填充两段文案
      if (about.bio) {
        const paragraphs = String(about.bio)
          .split(/\n{2,}/)
          .map(paragraph => paragraph.trim())
          .filter(Boolean);
        
        const aboutText1 = document.getElementById('about-text-1');
        const aboutText2 = document.getElementById('about-text-2');
        
        if (paragraphs[0] && aboutText1) {
          aboutText1.textContent = paragraphs[0];
        }
        // 只写了一段时，第二段保留页面默认文案
        if (paragraphs[1] && aboutText2) {
          aboutText2.textContent = paragraphs[1];
        }
      }
    }
  }

  // ========== 联系表单 ==========

  if (contactBtn) {
    contactBtn.addEventListener('click', () => {
      openModal(contactModal);
    });
  }

  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(contactForm);
      const name = formData.get('name');
      const email = formData.get('email');
      const message = formData.get('message');
      const formMessage = document.getElementById('form-message');
      const submitBtn = document.getElementById('contact-submit');
      const btnText = submitBtn.querySelector('.btn-text');
      const btnLoading = submitBtn.querySelector('.btn-loading');
      
      // 显示加载状态
      submitBtn.disabled = true;
      btnText.style.display = 'none';
      btnLoading.style.display = 'inline';
      formMessage.textContent = '';
      formMessage.className = 'form-message';
      
      try {
        const result = await apiFetch('/messages', {
          method: 'POST',
          body: JSON.stringify({ name, email, message })
        });
        
        if (result.success) {
          formMessage.textContent = result.data.message || '消息发送成功！';
          formMessage.className = 'form-message success';
          contactForm.reset();
          
          setTimeout(() => {
            closeModal(contactModal);
            showToast('消息已发送，感谢您的留言！', 'success');
            formMessage.textContent = '';
            formMessage.className = 'form-message';
          }, 1500);
        } else {
          formMessage.textContent = result.message || '发送失败，请稍后重试';
          formMessage.className = 'form-message error';
        }
      } catch (error) {
        formMessage.textContent = '网络错误，请稍后重试';
        formMessage.className = 'form-message error';
      } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
      }
    });
  }

  // ========== 初始化 ==========

  async function init() {
    // 并行加载数据
    await Promise.all([
      loadStats(),
      loadNotes(),
      loadProjects(),
      loadAbout()
    ]);
    
    console.log('🎉 学习随录 - 前端加载完成');
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
