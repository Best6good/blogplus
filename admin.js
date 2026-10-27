/**
 * 学习随录 — 内容管理后台脚本
 * 通过调用现有 REST API 完成「学习笔记 / 项目实践 / 关于我」的增删改查。
 * 视觉与前台保持一致：组件 class、动画曲线、Toast、主题切换逻辑均对齐 script.js。
 */

(function () {
  'use strict';

  // ========== 配置：接口地址自适应（与前台 script.js 同一套规则） ==========
  const BACKEND_ORIGIN = 'http://localhost:3001';

  const API_BASE = (function resolveApiBase() {
    const { protocol, hostname, port } = window.location;
    if (protocol === 'file:') return BACKEND_ORIGIN + '/api';

    const localHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];
    if (localHosts.indexOf(hostname) !== -1) {
      return port === '3001' ? '/api' : BACKEND_ORIGIN + '/api';
    }
    return '/api';
  })();

  // ========== DOM ==========
  const html = document.documentElement;
  const toast = document.getElementById('toast');
  const themeToggle = document.getElementById('themeToggle');
  const adminWarning = document.getElementById('adminWarning');
  const warningClose = document.getElementById('warningClose');

  const tabLinks = document.querySelectorAll('.main-nav .nav-link');
  const panels = {
    notes: document.getElementById('panel-notes'),
    projects: document.getElementById('panel-projects'),
    about: document.getElementById('panel-about')
  };

  // 笔记
  const notesList = document.getElementById('notesList');
  const notesCount = document.getElementById('notesCount');
  const notesForm = document.getElementById('notesForm');
  const notesFormTitle = document.getElementById('notesFormTitle');
  const noteId = document.getElementById('noteId');
  const noteTitle = document.getElementById('noteTitle');
  const noteExcerpt = document.getElementById('noteExcerpt');
  const noteTag = document.getElementById('noteTag');
  const noteContent = document.getElementById('noteContent');
  const notePreview = document.getElementById('notePreview');
  const notesSave = document.getElementById('notesSave');
  const notesDelete = document.getElementById('notesDelete');

  // 项目
  const projectsList = document.getElementById('projectsList');
  const projectsCount = document.getElementById('projectsCount');
  const projectsForm = document.getElementById('projectsForm');
  const projectsFormTitle = document.getElementById('projectsFormTitle');
  const projectId = document.getElementById('projectId');
  const projectTitle = document.getElementById('projectTitle');
  const projectDescription = document.getElementById('projectDescription');
  const projectTags = document.getElementById('projectTags');
  const projectVisual = document.getElementById('projectVisual');
  const projectVisualTrigger = document.getElementById('projectVisualTrigger');
  const projectVisualValue = document.getElementById('projectVisualValue');
  const projectVisualMenu = document.getElementById('projectVisualMenu');
  const projectVisualKeywords = document.getElementById('projectVisualKeywords');
  const projectPreviewUrl = document.getElementById('projectPreviewUrl');
  const projectSourceUrl = document.getElementById('projectSourceUrl');
  const projectFeatured = document.getElementById('projectFeatured');
  const projectContent = document.getElementById('projectContent');
  const projectPreview = document.getElementById('projectPreview');
  const projectsSave = document.getElementById('projectsSave');
  const projectsDelete = document.getElementById('projectsDelete');

  // 关于我
  const aboutForm = document.getElementById('aboutForm');
  const aboutName = document.getElementById('aboutName');
  const aboutAvatar = document.getElementById('aboutAvatar');
  const aboutBio = document.getElementById('aboutBio');
  const aboutEmail = document.getElementById('aboutEmail');
  const aboutGithub = document.getElementById('aboutGithub');
  const aboutSave = document.getElementById('aboutSave');

  // 确认弹窗
  const confirmModal = document.getElementById('confirmModal');
  const confirmText = document.getElementById('confirmText');
  const confirmOk = document.getElementById('confirmOk');

  // ========== 工具函数 ==========

  function escapeHTML(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  }

  /** Markdown 渲染：行为对齐前台 script.js 的 simpleMarkdownToHTML */
  function renderMarkdown(text) {
    if (!text) return '';

    let output = escapeHTML(text)
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/<\/ul>\n<ul>/g, '');

    if (!output.startsWith('<')) {
      output = '<p>' + output + '</p>';
    }
    output = output.replace(/^(<h[23]>)/, '</p>$1');
    output = output.replace(/(<\/(h[23]|pre|ul)>)(?=\n?[^<])/g, '$1<p>');

    return output;
  }

  // Toast：与前台同一套 class 与 2500ms 停留时长
  let toastTimer = null;
  function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  function debounce(fn, delay) {
    let timer = null;
    return function () {
      clearTimeout(timer);
      timer = setTimeout(fn, delay);
    };
  }

  function setSaving(button, saving) {
    button.disabled = saving;
    const text = button.querySelector('.btn-text');
    const loading = button.querySelector('.btn-loading');
    if (text) text.style.display = saving ? 'none' : 'inline';
    if (loading) loading.style.display = saving ? 'inline' : 'none';
  }

  // ========== API ==========

  async function apiFetch(endpoint, options = {}) {
    try {
      const { headers: optionHeaders, ...restOptions } = options;
      const headers = { 'Content-Type': 'application/json', ...(optionHeaders || {}) };

      // 可选：后端设置 ADMIN_TOKEN 时，前端在 localStorage 存同值即可自动附带
      // （未设置 blog_admin_token 时行为与之前完全一致）
      const adminToken = localStorage.getItem('blog_admin_token');
      if (adminToken) {
        headers.Authorization = `Bearer ${adminToken}`;
      }

      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers,
        ...restOptions
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

  // ========== 主题切换（复刻前台光晕扩散动画） ==========

  function getInitialTheme() {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }

  applyTheme(getInitialTheme());

  let themeAnimating = false;

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
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

      window.setTimeout(() => applyTheme(targetTheme), 550);
      window.setTimeout(() => {
        reveal.remove();
        themeAnimating = false;
      }, 1100);
    });
  }

  if (warningClose) {
    warningClose.addEventListener('click', () => {
      adminWarning.classList.add('is-hidden');
    });
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

  // 删除二次确认
  let confirmHandler = null;

  function askConfirm(text, onConfirm) {
    confirmText.textContent = text;
    confirmHandler = onConfirm;
    openModal(confirmModal);
  }

  document.querySelectorAll('#confirmModal .modal-close, #confirmCancel').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmHandler = null;
      closeModal(confirmModal);
    });
  });

  confirmModal.addEventListener('click', (event) => {
    if (event.target === confirmModal) {
      confirmHandler = null;
      closeModal(confirmModal);
    }
  });

  confirmOk.addEventListener('click', () => {
    const handler = confirmHandler;
    confirmHandler = null;
    closeModal(confirmModal);
    if (handler) handler();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(closeModal);
      confirmHandler = null;
    }
  });

  // ========== 列表渲染 ==========

  function renderTags(itemTags) {
    if (Array.isArray(itemTags) && itemTags.length) {
      return itemTags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('');
    }
    if (typeof itemTags === 'string' && itemTags.trim()) {
      return `<span class="tag">${escapeHTML(itemTags)}</span>`;
    }
    return '';
  }

  function renderList(container, items, onEdit, onDelete) {
    if (!items.length) {
      container.innerHTML = '<div class="empty-state">暂无内容，点击「新建」开始创作</div>';
      return;
    }

    container.innerHTML = items.map(item => `
      <article class="admin-item admin-item-enter" data-id="${item.id}">
        <div class="admin-item-main">
          <h4 class="admin-item-title">${escapeHTML(item.title)}</h4>
          <div class="admin-item-meta">
            ${renderTags(item.tag || item.tags)}
            <time>${formatDate(item.created_at)}</time>
          </div>
        </div>
        <div class="admin-item-actions">
          <button type="button" class="btn btn-secondary btn-sm" data-action="edit">编辑</button>
          <button type="button" class="btn btn-danger btn-sm" data-action="delete">删除</button>
        </div>
      </article>
    `).join('');

    // 逐项入场，步进 0.05s，与前台卡片节奏一致
    container.querySelectorAll('.admin-item').forEach((el, index) => {
      el.style.animationDelay = `${index * 0.05}s`;
    });

    container.querySelectorAll('.admin-item').forEach(el => {
      const id = parseInt(el.dataset.id, 10);
      el.querySelector('[data-action="edit"]').addEventListener('click', (event) => {
        event.stopPropagation();
        onEdit(id);
      });
      el.querySelector('[data-action="delete"]').addEventListener('click', (event) => {
        event.stopPropagation();
        onDelete(id);
      });
    });
  }

  function highlightItem(container, id) {
    container.querySelectorAll('.admin-item').forEach(el => {
      el.classList.toggle('is-active', parseInt(el.dataset.id, 10) === id);
    });
  }

  function scrollToForm(formPane) {
    if (window.innerWidth <= 1024) {
      formPane.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ========== 学习笔记 ==========

  function resetNoteForm() {
    noteId.value = '';
    notesForm.reset();
    notePreview.innerHTML = '';
    notesFormTitle.textContent = '新建笔记';
    notesDelete.style.display = 'none';
    highlightItem(notesList, null);
  }

  async function loadNotes() {
    notesList.innerHTML = '<div class="loading-state">加载中...</div>';

    const result = await apiFetch('/notes?limit=100');

    if (!result.success || !result.data) {
      notesList.innerHTML = '<div class="empty-state">加载失败：无法连接到后端服务</div>';
      notesCount.textContent = '0';
      return;
    }

    const list = result.data.list || [];
    notesCount.textContent = String(result.data.pagination ? result.data.pagination.total : list.length);

    renderList(
      notesList,
      list,
      editNote,
      id => askConfirm('删除后无法恢复，确认删除这篇笔记？', () => deleteNote(id))
    );
  }

  async function editNote(id) {
    const result = await apiFetch(`/notes/${id}`);

    if (!result.success || !result.data) {
      showToast('加载笔记失败', 'error');
      return;
    }

    const note = result.data.note;
    noteId.value = note.id;
    noteTitle.value = note.title || '';
    noteExcerpt.value = note.excerpt || '';
    noteTag.value = note.tag || '';
    noteContent.value = note.content || '';
    notePreview.innerHTML = renderMarkdown(note.content);

    notesFormTitle.textContent = '编辑笔记';
    notesDelete.style.display = 'inline-flex';
    highlightItem(notesList, id);
    scrollToForm(notesForm.closest('.admin-form-pane'));
  }

  async function submitNote(event) {
    event.preventDefault();

    const title = noteTitle.value.trim();
    if (!title) {
      showToast('标题不能为空', 'error');
      noteTitle.focus();
      return;
    }

    const payload = {
      title,
      excerpt: noteExcerpt.value.trim(),
      content: noteContent.value,
      tag: noteTag.value.trim()
    };

    const id = noteId.value;
    setSaving(notesSave, true);

    const result = id
      ? await apiFetch(`/notes/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await apiFetch('/notes', { method: 'POST', body: JSON.stringify(payload) });

    setSaving(notesSave, false);

    if (!result.success) {
      showToast(result.message || '保存失败', 'error');
      return;
    }

    showToast(id ? '笔记已更新' : '笔记已创建');
    apiFetch('/stats/invalidate', { method: 'POST' });
    await loadNotes();

    if (id) {
      highlightItem(notesList, parseInt(id, 10));
    } else {
      resetNoteForm();
    }
  }

  async function deleteNote(id) {
    const result = await apiFetch(`/notes/${id}`, { method: 'DELETE' });

    if (!result.success) {
      showToast(result.message || '删除失败', 'error');
      return;
    }

    showToast('笔记已删除');
    apiFetch('/stats/invalidate', { method: 'POST' });
    if (String(noteId.value) === String(id)) resetNoteForm();
    await loadNotes();
  }

  // ========== 项目实践 ==========

  function resetProjectForm() {
    projectId.value = '';
    projectsForm.reset();
    projectVisual.value = 'auto';
    projectVisualKeywords.value = '';
    syncVisualValue();
    projectPreview.innerHTML = '';
    projectsFormTitle.textContent = '新建项目';
    projectsDelete.style.display = 'none';
    highlightItem(projectsList, null);
  }

  async function loadProjects() {
    projectsList.innerHTML = '<div class="loading-state">加载中...</div>';

    const result = await apiFetch('/projects');

    if (!result.success || !result.data) {
      projectsList.innerHTML = '<div class="empty-state">加载失败：无法连接到后端服务</div>';
      projectsCount.textContent = '0';
      return;
    }

    const list = result.data || [];
    projectsCount.textContent = String(list.length);

    renderList(
      projectsList,
      list,
      editProject,
      id => askConfirm('删除后无法恢复，确认删除这个项目？', () => deleteProject(id))
    );
  }

  async function editProject(id) {
    const result = await apiFetch(`/projects/${id}`);

    if (!result.success || !result.data) {
      showToast('加载项目失败', 'error');
      return;
    }

    const project = result.data.project;
    projectId.value = project.id;
    projectTitle.value = project.title || '';
    projectDescription.value = project.description || '';
    projectTags.value = Array.isArray(project.tags) ? project.tags.join(',') : (project.tags || '');
    const visualType = project.visual_type || 'auto';
    const hasVisualOption = Array.from(projectVisual.options).some(o => o.value === visualType);
    projectVisual.value = hasVisualOption ? visualType : 'auto';
    syncVisualValue();
    projectVisualKeywords.value = project.visual_keywords || '';
    projectPreviewUrl.value = project.preview_url || '';
    projectSourceUrl.value = project.source_url || '';
    projectFeatured.checked = !!project.featured;
    projectContent.value = project.content || '';
    projectPreview.innerHTML = renderMarkdown(project.content);

    projectsFormTitle.textContent = '编辑项目';
    projectsDelete.style.display = 'inline-flex';
    highlightItem(projectsList, id);
    scrollToForm(projectsForm.closest('.admin-form-pane'));
  }

  async function submitProject(event) {
    event.preventDefault();

    const title = projectTitle.value.trim();
    if (!title) {
      showToast('项目名称不能为空', 'error');
      projectTitle.focus();
      return;
    }

    const payload = {
      title,
      description: projectDescription.value.trim(),
      tags: projectTags.value.trim(),
      visual_type: projectVisual.value,
      visual_keywords: projectVisualKeywords.value.trim(),
      preview_url: projectPreviewUrl.value.trim(),
      source_url: projectSourceUrl.value.trim(),
      featured: projectFeatured.checked ? 1 : 0,
      content: projectContent.value
    };

    const id = projectId.value;
    setSaving(projectsSave, true);

    const result = id
      ? await apiFetch(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await apiFetch('/projects', { method: 'POST', body: JSON.stringify(payload) });

    setSaving(projectsSave, false);

    if (!result.success) {
      showToast(result.message || '保存失败', 'error');
      return;
    }

    showToast(id ? '项目已更新' : '项目已创建');
    apiFetch('/stats/invalidate', { method: 'POST' });
    await loadProjects();

    if (id) {
      highlightItem(projectsList, parseInt(id, 10));
    } else {
      resetProjectForm();
    }
  }

  async function deleteProject(id) {
    const result = await apiFetch(`/projects/${id}`, { method: 'DELETE' });

    if (!result.success) {
      showToast(result.message || '删除失败', 'error');
      return;
    }

    showToast('项目已删除');
    apiFetch('/stats/invalidate', { method: 'POST' });
    if (String(projectId.value) === String(id)) resetProjectForm();
    await loadProjects();
  }

  // ========== 关于我 ==========

  // 将“关于我”中的名称与头像文字同步到左上角品牌
  function applyAboutBrand(about) {
    if (!about) return;
    const mark = document.querySelector('.site-header .brand-mark');
    const name = document.querySelector('.site-header .brand-name');
    const markText = String(about.avatar_text || '').trim()
      || String(about.name || '').trim().slice(0, 1)
      || '学';
    if (mark) mark.textContent = markText;
    if (name) name.textContent = String(about.name || '').trim() || '学习随录';
  }

  async function loadAbout() {
    const result = await apiFetch('/about');

    if (!result.success || !result.data) {
      showToast('加载关于我信息失败', 'error');
      return;
    }

    const about = result.data;
    aboutName.value = about.name || '';
    aboutBio.value = about.bio || '';
    aboutEmail.value = about.email || '';
    aboutGithub.value = about.github || '';
    aboutAvatar.value = about.avatar_text || '';

    // 同步左上角品牌（名称 + 头像文字）
    applyAboutBrand(about);
  }

  async function submitAbout(event) {
    event.preventDefault();

    const payload = {
      name: aboutName.value.trim(),
      bio: aboutBio.value.trim(),
      email: aboutEmail.value.trim(),
      github: aboutGithub.value.trim(),
      avatar_text: aboutAvatar.value.trim()
    };

    setSaving(aboutSave, true);
    const result = await apiFetch('/about', { method: 'PUT', body: JSON.stringify(payload) });
    setSaving(aboutSave, false);

    if (!result.success) {
      showToast(result.message || '保存失败', 'error');
      return;
    }

    showToast('关于我信息已保存');
    // 保存成功后立即同步左上角品牌（无需刷新页面即可看到变化）
    applyAboutBrand(payload);
  }

  // ========== Tab 切换 ==========

  function switchTab(name) {
    tabLinks.forEach(link => {
      link.classList.toggle('is-active', link.dataset.tab === name);
    });

    Object.keys(panels).forEach(key => {
      panels[key].classList.toggle('is-active', key === name);
    });

    if (name === 'notes') loadNotes();
    if (name === 'projects') loadProjects();
    if (name === 'about') loadAbout();
  }

  tabLinks.forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      switchTab(link.dataset.tab);
    });
  });

  // ========== 玻璃下拉：卡片预览样式（visual_type） ==========
  // 原生 <select> 的弹出层无法磨砂化，改为自定义玻璃面板展示与选择，
  // 选中后回写隐藏的原生 select（projectVisual.value），不影响现有保存逻辑。
  function buildVisualMenu() {
    if (!projectVisual || !projectVisualMenu) return;
    projectVisualMenu.innerHTML = '';
    Array.from(projectVisual.options).forEach((opt) => {
      const li = document.createElement('li');
      li.className = 'glass-select-option';
      li.dataset.value = opt.value;
      li.textContent = opt.textContent;
      li.setAttribute('role', 'option');
      li.addEventListener('click', () => {
        projectVisual.value = opt.value;
        closeVisualMenu();
        syncVisualValue();
      });
      projectVisualMenu.appendChild(li);
    });
  }

  function currentVisualLabel() {
    if (!projectVisual) return '';
    const idx = projectVisual.selectedIndex;
    const opt = idx >= 0 ? projectVisual.options[idx] : projectVisual.options[0];
    return opt ? opt.textContent : '';
  }

  // 将原生 select 当前值同步到按钮文字与面板高亮
  function syncVisualValue() {
    if (!projectVisualValue) return;
    projectVisualValue.textContent = currentVisualLabel();
    const val = projectVisual.value || (projectVisual.options[0] && projectVisual.options[0].value) || '';
    const items = projectVisualMenu ? projectVisualMenu.querySelectorAll('.glass-select-option') : [];
    Array.prototype.forEach.call(items, (li) => {
      li.classList.toggle('is-active', li.dataset.value === val);
    });
  }

  function openVisualMenu() {
    if (!projectVisualMenu) return;
    const wrap = projectVisualTrigger ? projectVisualTrigger.closest('.glass-select') : null;
    if (wrap) wrap.classList.add('open');
    if (projectVisualTrigger) projectVisualTrigger.setAttribute('aria-expanded', 'true');
    projectVisualMenu.hidden = false;
  }
  function closeVisualMenu() {
    if (!projectVisualMenu) return;
    const wrap = projectVisualTrigger ? projectVisualTrigger.closest('.glass-select') : null;
    if (wrap) wrap.classList.remove('open');
    if (projectVisualTrigger) projectVisualTrigger.setAttribute('aria-expanded', 'false');
    projectVisualMenu.hidden = true;
  }
  function toggleVisualMenu() {
    if (projectVisualMenu && projectVisualMenu.hidden) openVisualMenu();
    else closeVisualMenu();
  }

  // ========== 事件绑定 ==========

  if (projectVisualTrigger) {
    projectVisualTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleVisualMenu();
    });
  }
  document.addEventListener('click', (e) => {
    if (projectVisualMenu && !projectVisualMenu.hidden && !e.target.closest('.glass-select')) {
      closeVisualMenu();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeVisualMenu();
  });

  notesForm.addEventListener('submit', submitNote);
  projectsForm.addEventListener('submit', submitProject);
  aboutForm.addEventListener('submit', submitAbout);

  document.getElementById('notesNew').addEventListener('click', resetNoteForm);
  document.getElementById('notesCancel').addEventListener('click', resetNoteForm);
  document.getElementById('notesRefresh').addEventListener('click', loadNotes);
  notesDelete.addEventListener('click', () => {
    const id = noteId.value;
    if (!id) return;
    askConfirm('删除后无法恢复，确认删除这篇笔记？', () => deleteNote(id));
  });

  document.getElementById('projectsNew').addEventListener('click', resetProjectForm);
  document.getElementById('projectsCancel').addEventListener('click', resetProjectForm);
  document.getElementById('projectsRefresh').addEventListener('click', loadProjects);
  projectsDelete.addEventListener('click', () => {
    const id = projectId.value;
    if (!id) return;
    askConfirm('删除后无法恢复，确认删除这个项目？', () => deleteProject(id));
  });

  document.getElementById('aboutRefresh').addEventListener('click', loadAbout);

  // Markdown 实时预览（200ms 防抖）
  noteContent.addEventListener('input', debounce(() => {
    notePreview.innerHTML = renderMarkdown(noteContent.value);
  }, 200));

  projectContent.addEventListener('input', debounce(() => {
    projectPreview.innerHTML = renderMarkdown(projectContent.value);
  }, 200));

  // ========== 初始化 ==========

  buildVisualMenu();
  syncVisualValue();
  switchTab('notes');
  console.log('🛠 学习随录 — 管理后台已就绪，接口地址：' + API_BASE);
})();
