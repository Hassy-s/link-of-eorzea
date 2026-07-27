(() => {
  'use strict';

  const STORAGE_KEY = 'eorzeaLinkHubV3';
  const SETTINGS_KEY = 'eorzeaLinkHubSettingsV3';
  const createId = () => crypto.randomUUID();
  const now = () => new Date().toISOString();

  const defaultData = {
    version: 3,
    categories: [
      {
        id: createId(),
        name: '攻略',
        subcategories: [
          { id: createId(), name: '絶エデン', links: [] },
        ],
        links: []
      },
      { id: createId(), name: '戦闘/装備', subcategories: [], links: [] },
      { id: createId(), name: 'ギャザクラ', subcategories: [], links: [] },
      { id: createId(), name: 'ハウジング', subcategories: [], links: [] },
      { id: createId(), name: '一時保存', subcategories: [], links: [] },
      { id: createId(), name: '公式関連', subcategories: [], links: [] },
      { id: createId(), name: 'SNS', subcategories: [], links: [] }
    ]
  };

  let data = loadData();
  let settings = loadSettings();
  let selection = { type: 'favorites', categoryId: null, subcategoryId: null };
  let expandedCategoryIds = new Set(data.categories.filter(category => category.subcategories.length).map(category => category.id));
  let managementMode = false;
  let dragState = null;
  let toastTimer;
  let bookmarkImportState = { fileName: '', folders: [], selectedIds: new Set() };

  const $ = id => document.getElementById(id);
  const elements = {
    categoryList: $('categoryList'),
    linkList: $('linkList'),
    emptyState: $('emptyState'),
    emptyStateTitle: $('emptyStateTitle'),
    emptyStateText: $('emptyStateText'),
    currentCategoryName: $('currentCategoryName'),
    searchResultCount: $('searchResultCount'),
    currentPathLabel: $('currentPathLabel'),
    searchInput: $('searchInput'),
    addCategoryButton: $('addCategoryButton'),
    addLinkButton: $('addLinkButton'),
    managementToggleButton: $('managementToggleButton'),
    managementTools: $('managementTools'),
    exportButton: $('exportButton'),
    importInput: $('importInput'),
    bookmarkImportInput: $('bookmarkImportInput'),
    bookmarkImportDialog: $('bookmarkImportDialog'),
    bookmarkImportForm: $('bookmarkImportForm'),
    bookmarkImportFileName: $('bookmarkImportFileName'),
    bookmarkFolderTree: $('bookmarkFolderTree'),
    bookmarkFolderEmpty: $('bookmarkFolderEmpty'),
    bookmarkImportSummary: $('bookmarkImportSummary'),
    bookmarkImportExecuteButton: $('bookmarkImportExecuteButton'),
    bookmarkClearSelectionButton: $('bookmarkClearSelectionButton'),
    resetDataButton: $('resetDataButton'),
    toast: $('toast'),
    categoryDialog: $('categoryDialog'),
    categoryForm: $('categoryForm'),
    categoryDialogTitle: $('categoryDialogTitle'),
    categoryNameInput: $('categoryNameInput'),
    editingCategoryId: $('editingCategoryId'),
    categoryManagerDialog: $('categoryManagerDialog'),
    categoryManagerForm: $('categoryManagerForm'),
    managerCategoryNameInput: $('managerCategoryNameInput'),
    managerCategoryId: $('managerCategoryId'),
    managerSubcategoryList: $('managerSubcategoryList'),
    managerSubcategoryEmpty: $('managerSubcategoryEmpty'),
    managerAddSubcategoryButton: $('managerAddSubcategoryButton'),
    managerDeleteCategoryButton: $('managerDeleteCategoryButton'),
    subcategoryDialog: $('subcategoryDialog'),
    subcategoryForm: $('subcategoryForm'),
    subcategoryDialogTitle: $('subcategoryDialogTitle'),
    subcategoryNameInput: $('subcategoryNameInput'),
    subcategoryCategoryId: $('subcategoryCategoryId'),
    editingSubcategoryId: $('editingSubcategoryId'),
    linkDialog: $('linkDialog'),
    linkForm: $('linkForm'),
    linkDialogTitle: $('linkDialogTitle'),
    siteNameInput: $('siteNameInput'),
    siteUrlInput: $('siteUrlInput'),
    siteMemoInput: $('siteMemoInput'),
    siteImageInput: $('siteImageInput'),
    siteFavoriteInput: $('siteFavoriteInput'),
    editingLinkId: $('editingLinkId'),
    linkSaveButton: $('linkSaveButton'),
    linkLocationFields: $('linkLocationFields'),
    siteCategorySelect: $('siteCategorySelect'),
    siteSubcategorySelect: $('siteSubcategorySelect'),
    imageSettingsHelp: $('imageSettingsHelp'),
    imageModeControls: $('imageModeControls'),
    customImageField: $('customImageField'),
    imagePreviewPanel: $('imagePreviewPanel'),
    imagePreviewWrap: $('imagePreviewWrap'),
    imagePreviewMessage: $('imagePreviewMessage')
  };

  function loadData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.categories && Array.isArray(saved.categories)) return normalizeData(saved);
    } catch (error) {
      console.warn('保存データを読み込めませんでした。', error);
    }
    return structuredClone(defaultData);
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      if (saved?.imageSize === 'large') return { imageSize: 'large-square' };
      if (saved?.imageSize==='large-wide') return {imageSize:'large-square'};
      if (['large-square','small','none'].includes(saved?.imageSize)) return saved;
    } catch (error) {
      console.warn('表示設定を読み込めませんでした。', error);
    }
    return { imageSize: 'large-square' };
  }

  function normalizeData(raw) {
    return {
      version: 3,
      categories: raw.categories.map(category => ({
        id: category.id || createId(),
        name: String(category.name || '名称未設定'),
        links: normalizeLinks(category.links),
        subcategories: Array.isArray(category.subcategories)
          ? category.subcategories.map(subcategory => ({
              id: subcategory.id || createId(),
              name: String(subcategory.name || '名称未設定'),
              links: normalizeLinks(subcategory.links)
            }))
          : []
      }))
    };
  }

  function normalizeLinks(links) {
    if (!Array.isArray(links)) return [];
    return links.map(link => ({
      id: link.id || createId(),
      name: String(link.name || '名称未設定'),
      url: String(link.url || ''),
      memo: String(link.memo || ''),
      imageUrl: String(link.imageUrl || ''),
      imageMode: ['auto', 'custom', 'youtube', 'favicon'].includes(link.imageMode)
        ? link.imageMode
        : (link.imageUrl ? 'custom' : 'auto'),
      favorite: Boolean(link.favorite),
      createdAt: link.createdAt || now(),
      updatedAt: link.updatedAt || now()
    }));
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 1600);
  }

  function getCategory(id) {
    return data.categories.find(category => category.id === id);
  }

  function getSubcategory(category, id) {
    return category?.subcategories.find(subcategory => subcategory.id === id);
  }

  function getSelectedContainer() {
    if (selection.type === 'category') return getCategory(selection.categoryId)?.links;
    if (selection.type === 'subcategory') return getSubcategory(getCategory(selection.categoryId), selection.subcategoryId)?.links;
    return null;
  }

  function allLinks() {
    return data.categories.flatMap(category => [
      ...category.links.map(link => ({ link, categoryId: category.id, subcategoryId: null, categoryName: category.name, subcategoryName: '' })),
      ...category.subcategories.flatMap(subcategory => subcategory.links.map(link => ({
        link,
        categoryId: category.id,
        subcategoryId: subcategory.id,
        categoryName: category.name,
        subcategoryName: subcategory.name
      })))
    ]);
  }

  function findLinkLocation(categoryId, subcategoryId, linkId) {
    const category = getCategory(categoryId);
    const container = subcategoryId ? getSubcategory(category, subcategoryId)?.links : category?.links;
    return { container, link: container?.find(item => item.id === linkId) };
  }

  function getYouTubeId(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();

      if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || '';
      if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
        if (url.pathname === '/watch') return url.searchParams.get('v') || '';
        const parts = url.pathname.split('/').filter(Boolean);
        if (['shorts', 'embed', 'live'].includes(parts[0])) return parts[1] || '';
      }
    } catch {}
    return '';
  }

  function getFaviconUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=256`;
    } catch {
      return '';
    }
  }

  function resolveImage(linkLike) {
    const mode = linkLike.imageMode || 'auto';
    const youtubeId = getYouTubeId(linkLike.url);
    const customUrl = String(linkLike.imageUrl || '').trim();

    if (mode === 'custom') {
      return { url: customUrl, type: 'custom' };
    }

    if (mode === 'youtube') {
      return {
        url: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : '',
        type: 'youtube'
      };
    }

    if (mode === 'favicon') {
      return { url: getFaviconUrl(linkLike.url), type: 'favicon' };
    }

    if (customUrl) return { url: customUrl, type: 'custom' };
    if (youtubeId) {
      return {
        url: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
        type: 'youtube'
      };
    }
    return { url: getFaviconUrl(linkLike.url), type: 'favicon' };
  }


  function applyImageSizeSetting() {
    document.body.classList.remove(
      'image-size-large',
            'image-size-large-square',
      'image-size-small',
      'image-size-none'
    );
    document.body.classList.add(`image-size-${settings.imageSize}`);
    document.querySelectorAll('[data-image-size]').forEach(button => {
      const active = button.dataset.imageSize === settings.imageSize;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }


  function normalizeBookmarkUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || '').trim());
      url.hash = '';
      if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
      return url.toString();
    } catch {
      return String(rawUrl || '').trim();
    }
  }

  function parseBookmarkHtml(htmlText) {
    const documentNode = new DOMParser().parseFromString(htmlText, 'text/html');
    let folderCounter = 0;

    function parseDl(dl, parentPath = []) {
      const folders = [];
      const children = Array.from(dl?.children || []);

      for (let index = 0; index < children.length; index += 1) {
        const element = children[index];
        if (element.tagName !== 'DT') continue;

        const heading = element.querySelector(':scope > H3');
        const anchor = element.querySelector(':scope > A');

        if (heading) {
          let nestedDl = element.querySelector(':scope > DL');
          if (!nestedDl) {
            const next = children[index + 1];
            if (next?.tagName === 'DL') {
              nestedDl = next;
              index += 1;
            }
          }

          const name = heading.textContent.trim() || '名称未設定';
          const parsedChildren = parseDl(nestedDl, [...parentPath, name]);
          const directLinks = [];
          Array.from(nestedDl?.children || []).forEach(child => {
            if (child.tagName !== 'DT') return;
            const directAnchor = child.querySelector(':scope > A');
            if (!directAnchor?.href) return;
            directLinks.push({
              name: directAnchor.textContent.trim() || directAnchor.href,
              url: directAnchor.href
            });
          });

          folders.push({
            id: `bookmark-folder-${folderCounter++}`,
            name,
            path: [...parentPath, name],
            links: directLinks,
            children: parsedChildren
          });
        } else if (anchor) {
          // フォルダ直下のリンクは親フォルダ側で収集するため、ここでは処理しない。
        }
      }
      return folders;
    }

    const rootDl = documentNode.querySelector('DL');
    return rootDl ? parseDl(rootDl) : [];
  }

  function countBookmarkLinks(folder) {
    return folder.links.length + folder.children.reduce((total, child) => total + countBookmarkLinks(child), 0);
  }

  function flattenBookmarkFolders(folders, parentId = null, depth = 0) {
    return folders.flatMap(folder => [
      { folder, parentId, depth },
      ...flattenBookmarkFolders(folder.children, folder.id, depth + 1)
    ]);
  }

  function renderBookmarkFolderTree() {
    const flatFolders = flattenBookmarkFolders(bookmarkImportState.folders);
    elements.bookmarkFolderEmpty.hidden = flatFolders.length > 0;
    elements.bookmarkFolderTree.innerHTML = flatFolders.map(({ folder, depth }) => {
      const count = countBookmarkLinks(folder);
      const checked = bookmarkImportState.selectedIds.has(folder.id);
      return `
        <label class="bookmark-folder-row" style="--bookmark-depth:${depth}">
          <input type="checkbox" data-bookmark-folder-id="${folder.id}" ${checked ? 'checked' : ''}>
          <span class="bookmark-folder-icon">${folder.children.length ? '▾' : '•'}</span>
          <span class="bookmark-folder-name">${escapeHtml(folder.name)}</span>
          <span class="bookmark-folder-count">${count}件</span>
        </label>`;
    }).join('');
    updateBookmarkImportSummary();
  }

  function getEffectiveSelectedBookmarkFolders() {
    const flatFolders = flattenBookmarkFolders(bookmarkImportState.folders);
    const selected = new Set(bookmarkImportState.selectedIds);
    const byId = new Map(flatFolders.map(item => [item.folder.id, item]));

    return flatFolders
      .filter(({ folder }) => selected.has(folder.id))
      .filter(({ parentId }) => {
        let currentParentId = parentId;
        while (currentParentId) {
          if (selected.has(currentParentId)) return false;
          currentParentId = byId.get(currentParentId)?.parentId || null;
        }
        return true;
      })
      .map(({ folder }) => folder);
  }

  function updateBookmarkImportSummary() {
    const selectedFolders = getEffectiveSelectedBookmarkFolders();
    const totalLinks = selectedFolders.reduce((total, folder) => total + countBookmarkLinks(folder), 0);
    const rawSelectedCount = bookmarkImportState.selectedIds.size;

    if (!rawSelectedCount) {
      elements.bookmarkImportSummary.textContent = 'フォルダを選択してください。';
      elements.bookmarkImportExecuteButton.disabled = true;
      return;
    }

    elements.bookmarkImportSummary.textContent = `${selectedFolders.length}フォルダ・最大${totalLinks}件を、新しい「インポート YYYY-MM-DD」ジャンルへ取り込みます。登録済みURLは自動でスキップします。`;
    elements.bookmarkImportExecuteButton.disabled = totalLinks === 0;
  }

  function createImportCategoryName() {
    const date = new Date();
    const baseName = `インポート ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const existingNames = new Set(data.categories.map(category => category.name.trim().toLowerCase()));
    if (!existingNames.has(baseName.toLowerCase())) return baseName;

    let number = 2;
    while (existingNames.has(`${baseName} (${number})`.toLowerCase())) number += 1;
    return `${baseName} (${number})`;
  }

  function findOrCreateImportSubcategory(category, name) {
    const normalizedName = name.trim().toLowerCase();
    let subcategory = category.subcategories.find(item => item.name.trim().toLowerCase() === normalizedName);
    if (!subcategory) {
      subcategory = { id: createId(), name: name.trim() || '名称未設定', links: [] };
      category.subcategories.push(subcategory);
    }
    return subcategory;
  }

  function createImportedLink(bookmark) {
    return {
      id: createId(),
      name: String(bookmark.name || bookmark.url || '名称未設定'),
      url: String(bookmark.url || ''),
      memo: '',
      imageUrl: '',
      imageMode: 'auto',
      favorite: false,
      createdAt: now(),
      updatedAt: now()
    };
  }

  function importBookmarkFoldersIntoNewCategory(folders, existingUrls) {
    const category = {
      id: createId(),
      name: createImportCategoryName(),
      subcategories: [],
      links: []
    };
    data.categories.push(category);

    let added = 0;
    let skipped = 0;
    const includeRootFolderName = folders.length > 1;

    function addLinks(target, links) {
      links.forEach(bookmark => {
        const normalizedUrl = normalizeBookmarkUrl(bookmark.url);
        if (!normalizedUrl || existingUrls.has(normalizedUrl)) {
          skipped += 1;
          return;
        }
        target.push(createImportedLink(bookmark));
        existingUrls.add(normalizedUrl);
        added += 1;
      });
    }

    function importFolder(folder, path = [], isSelectedRoot = false) {
      const currentPath = isSelectedRoot && !includeRootFolderName
        ? path
        : [...path, folder.name];

      const target = currentPath.length
        ? findOrCreateImportSubcategory(category, currentPath.join(' > ')).links
        : category.links;
      addLinks(target, folder.links);

      folder.children.forEach(child => importFolder(child, currentPath, false));
    }

    folders.forEach(folder => importFolder(folder, [], true));

    if (!added) {
      data.categories.splice(data.categories.findIndex(item => item.id === category.id), 1);
      return { category: null, added, skipped };
    }

    expandedCategoryIds.add(category.id);
    return { category, added, skipped };
  }

  function resetBookmarkImportDialog() {
    bookmarkImportState = { fileName: '', folders: [], selectedIds: new Set() };
    elements.bookmarkImportFileName.textContent = '未選択';
    elements.bookmarkFolderTree.innerHTML = '';
    elements.bookmarkFolderEmpty.hidden = true;
    elements.bookmarkImportSummary.textContent = 'フォルダを選択してください。';
    elements.bookmarkImportExecuteButton.disabled = true;
  }


  function render() {
    document.body.classList.toggle('management-mode', managementMode);
    elements.managementTools.hidden = !managementMode;
    elements.managementToggleButton.textContent = managementMode ? '管理を終了' : '⚙ 管理';
    elements.managementToggleButton.setAttribute('aria-pressed', String(managementMode));
    applyImageSizeSetting();
    renderSidebar();
    renderContentHeader();
    renderLinks();
  }

  function renderSidebar() {
    const favoriteActive = selection.type === 'favorites' ? ' active' : '';
    const categoriesHtml = data.categories.map(category => {
      const expanded = expandedCategoryIds.has(category.id);
      const categoryActive = selection.type === 'category' && selection.categoryId === category.id;
      const categoryAdmin = managementMode ? `
        <div class="category-actions admin-only">
          <button class="drag-handle small-icon-button" draggable="true" data-drag-type="category" data-category-id="${category.id}" aria-label="${escapeHtml(category.name)}を並び替え" title="ドラッグして並び替え">☰</button>
          <button class="small-icon-button category-manage-button" data-action="manage-category" data-category-id="${category.id}" title="ジャンル管理" aria-label="${escapeHtml(category.name)}を管理">⚙</button>
        </div>` : '';

      const subcategoriesHtml = expanded && category.subcategories.length ? `
        <div class="subcategory-list">
          ${category.subcategories.map(subcategory => {
            const subcategoryAdmin = '';
            return `
              <div class="subcategory-row sortable-item" data-drop-type="subcategory" data-category-id="${category.id}" data-subcategory-id="${subcategory.id}">
                <button class="subcategory-select${selection.type === 'subcategory' && selection.subcategoryId === subcategory.id ? ' active' : ''}" data-action="select-subcategory" data-category-id="${category.id}" data-subcategory-id="${subcategory.id}">${escapeHtml(subcategory.name)}</button>
                ${subcategoryAdmin}
              </div>`;
          }).join('')}
        </div>` : '';

      return `
        <div class="category-block sortable-item" data-drop-type="category" data-category-id="${category.id}">
          <div class="category-row">
            <button class="category-select${categoryActive ? ' active' : ''}" data-action="select-category" data-category-id="${category.id}">
              <span class="category-main">
                <span class="category-chevron">${category.subcategories.length ? (expanded ? '▼' : '▶') : '•'}</span>
                <span class="category-name">${escapeHtml(category.name)}</span>
              </span>
            </button>
            ${categoryAdmin}
          </div>
          ${subcategoriesHtml}
        </div>`;
    }).join('');

    elements.categoryList.innerHTML = `
      <button class="favorite-nav${favoriteActive}" data-action="select-favorites">★ お気に入り</button>
      ${categoriesHtml}`;
  }

  function renderContentHeader() {
    const query = elements.searchInput.value.trim();

    if (query) {
      const resultCount = getVisibleEntries().length;
      elements.currentPathLabel.textContent = 'SEARCH';
      elements.currentCategoryName.textContent = '🔍 検索結果';
      elements.searchResultCount.textContent = `${resultCount}件見つかりました`;
      elements.searchResultCount.hidden = false;
      elements.addLinkButton.hidden = true;
      elements.addLinkButton.parentElement.hidden = true;
      return;
    }

    elements.searchResultCount.hidden = true;
    elements.searchResultCount.textContent = '';

    if (selection.type === 'favorites') {
      elements.currentPathLabel.textContent = 'FAVORITES';
      elements.currentCategoryName.textContent = 'お気に入り';
      elements.addLinkButton.hidden = true;
      elements.addLinkButton.parentElement.hidden = true;
      return;
    }

    elements.addLinkButton.hidden = false;
    elements.addLinkButton.parentElement.hidden = false;
    const category = getCategory(selection.categoryId);
    const subcategory = selection.type === 'subcategory' ? getSubcategory(category, selection.subcategoryId) : null;
    elements.currentPathLabel.textContent = subcategory ? category.name : 'CATEGORY';
    elements.currentCategoryName.textContent = subcategory ? subcategory.name : category?.name || '';
    elements.addLinkButton.disabled = false;
    elements.addLinkButton.title = '';
  }

  function getVisibleEntries() {
    const query = elements.searchInput.value.trim().toLowerCase();
    let entries;

    // 検索中は、現在開いている場所に関係なく全ジャンル・全サブカテゴリを対象にする。
    if (query) {
      entries = allLinks();
      return entries.filter(({ link, categoryName, subcategoryName }) =>
        `${link.name} ${link.url} ${link.memo} ${categoryName} ${subcategoryName}`.toLowerCase().includes(query)
      );
    }

    if (selection.type === 'favorites') {
      return allLinks().filter(entry => entry.link.favorite);
    }

    const category = getCategory(selection.categoryId);
    const subcategory = selection.type === 'subcategory' ? getSubcategory(category, selection.subcategoryId) : null;
    return (getSelectedContainer() || []).map(link => ({
      link,
      categoryId: selection.categoryId,
      subcategoryId: subcategory?.id || null,
      categoryName: category?.name || '',
      subcategoryName: subcategory?.name || ''
    }));
  }

  function renderLinks() {
    const entries = getVisibleEntries();
    const isSearching = Boolean(elements.searchInput.value.trim());
    const canReorder = managementMode && selection.type !== 'favorites' && !isSearching;

    elements.emptyState.hidden = entries.length > 0;

    if (isSearching) {
      elements.emptyStateTitle.textContent = '該当するサイトが見つかりません';
      elements.emptyStateText.textContent = '検索語を変えて、もう一度お試しください。';
    } else {
      elements.emptyStateTitle.textContent = selection.type === 'favorites' ? 'お気に入りはまだありません' : 'まだサイトがありません';
      elements.emptyStateText.textContent = selection.type === 'favorites'
        ? 'サイトをお気に入りにすると、ここにまとめて表示されます。'
        : '「サイトを追加」から、よく使うサイトを登録してください。';
    }

    elements.linkList.innerHTML = entries.map(({ link, categoryId, subcategoryId, categoryName, subcategoryName }) => {
      const image = resolveImage(link);
      const faviconClass = image.type === 'favicon' ? ' favicon-mode' : '';
      const imageClass = image.type === 'favicon' ? ' favicon-image' : '';
      const favoriteAction = `
        <button class="favorite-button${link.favorite ? ' active' : ''}" data-action="toggle-favorite" data-link-id="${link.id}" data-category-id="${categoryId}" data-subcategory-id="${subcategoryId || ''}" title="${link.favorite ? 'お気に入りから外す' : 'お気に入りに追加'}" aria-label="${link.favorite ? 'お気に入りから外す' : 'お気に入りに追加'}" aria-pressed="${link.favorite ? 'true' : 'false'}">${link.favorite ? '★' : '☆'}</button>`;
      const adminActions = managementMode ? `
        <button data-action="edit-link" data-link-id="${link.id}" data-category-id="${categoryId}" data-subcategory-id="${subcategoryId || ''}">編集</button>
        <button class="delete-button" data-action="delete-link" data-link-id="${link.id}" data-category-id="${categoryId}" data-subcategory-id="${subcategoryId || ''}">削除</button>` : '';
      const dragHandle = canReorder ? `
        <button class="card-drag-handle drag-handle" draggable="true" data-drag-type="link" data-category-id="${categoryId}" data-subcategory-id="${subcategoryId || ''}" data-link-id="${link.id}" aria-label="${escapeHtml(link.name)}を並び替え" title="ドラッグして並び替え・別ジャンルへ移動">☰</button>` : '';

      return `
        <article class="link-card sortable-item" data-drop-type="link" data-category-id="${categoryId}" data-subcategory-id="${subcategoryId || ''}" data-link-id="${link.id}">
          ${dragHandle}
          <a class="card-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(link.name)}を開く">
            <div class="card-image-wrap${faviconClass}">
              ${image.url ? `<img class="card-image${imageClass}" src="${escapeHtml(image.url)}" alt="" loading="lazy" onerror="this.closest('.card-image-wrap').classList.add('image-error');this.remove();">` : ''}
            </div>
            <div class="card-body">
              ${isSearching ? `<p class="card-location">${escapeHtml(subcategoryName ? `${categoryName} > ${subcategoryName}` : categoryName)}</p>` : ''}
              <h3>${escapeHtml(link.name)}</h3>
              <p class="link-memo">${escapeHtml(link.memo || 'メモなし')}</p>
            </div>
          </a>
          <div class="card-actions">
            <button data-action="copy-link" data-url="${escapeHtml(link.url)}">コピー</button>
            ${favoriteAction}
            ${adminActions}
          </div>
        </article>`;
    }).join('');
  }

  function reorderById(array, draggedId, targetId) {
    const fromIndex = array.findIndex(item => item.id === draggedId);
    const toIndex = array.findIndex(item => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return false;
    const [moved] = array.splice(fromIndex, 1);
    array.splice(toIndex, 0, moved);
    return true;
  }

  function clearDragStyles() {
    document.body.classList.remove('link-drag-active');
    document.querySelectorAll('.dragging, .drag-over, .drop-target-available').forEach(element => {
      element.classList.remove('dragging', 'drag-over', 'drop-target-available');
    });
  }

  function markLinkDropTargets() {
    document.body.classList.add('link-drag-active');
    elements.categoryList.querySelectorAll('[data-drop-type="category"], [data-drop-type="subcategory"]').forEach(target => {
      target.classList.add('drop-target-available');
    });
  }

  function getDragDropTarget(event) {
    if (!dragState) return null;

    if (dragState.type === 'link') {
      // サイドバーでは、より具体的なサブカテゴリをジャンルより優先する。
      const subcategoryTarget = event.target.closest('[data-drop-type="subcategory"]');
      if (subcategoryTarget && elements.categoryList.contains(subcategoryTarget)) return subcategoryTarget;

      const categoryTarget = event.target.closest('[data-drop-type="category"]');
      if (categoryTarget && elements.categoryList.contains(categoryTarget)) return categoryTarget;

      // カード同士へのドロップは、同じ保存先内での並び替えに使う。
      const linkTarget = event.target.closest('[data-drop-type="link"]');
      if (linkTarget && elements.linkList.contains(linkTarget)) return linkTarget;
      return null;
    }

    return event.target.closest(`[data-drop-type="${dragState.type}"]`);
  }

  function isValidDropTarget(target) {
    if (!target || !dragState) return false;

    if (dragState.type === 'category') return target.dataset.dropType === 'category';

    if (['subcategory', 'manager-subcategory'].includes(dragState.type)) {
      return target.dataset.dropType === dragState.type && target.dataset.categoryId === dragState.categoryId;
    }

    if (dragState.type === 'link') {
      if (target.dataset.dropType === 'link') {
        return target.dataset.categoryId === dragState.categoryId &&
          (target.dataset.subcategoryId || '') === (dragState.subcategoryId || '');
      }
      return ['category', 'subcategory'].includes(target.dataset.dropType);
    }

    return false;
  }

  function getLinkTargetLocation(target) {
    if (target.dataset.dropType === 'subcategory') {
      const category = getCategory(target.dataset.categoryId);
      const subcategory = getSubcategory(category, target.dataset.subcategoryId);
      return {
        category,
        subcategory,
        container: subcategory?.links,
        label: subcategory ? `${category.name} > ${subcategory.name}` : ''
      };
    }

    const category = getCategory(target.dataset.categoryId);
    return {
      category,
      subcategory: null,
      container: category?.links,
      label: category?.name || ''
    };
  }

  function moveLinkToSidebarTarget(target) {
    const source = findLinkLocation(dragState.categoryId, dragState.subcategoryId || null, dragState.linkId);
    if (!source.link || !Array.isArray(source.container)) return { changed: false };

    const destination = getLinkTargetLocation(target);
    if (!destination.category || !Array.isArray(destination.container)) return { changed: false };

    const sameLocation = destination.category.id === dragState.categoryId &&
      (destination.subcategory?.id || '') === (dragState.subcategoryId || '');
    if (sameLocation) return { changed: false, message: 'すでにこの場所に登録されています' };

    const normalizedUrl = normalizeBookmarkUrl(source.link.url);
    const duplicate = destination.container.some(link =>
      link.id !== source.link.id && normalizeBookmarkUrl(link.url) === normalizedUrl
    );
    if (duplicate) return { changed: false, message: '移動先に同じURLがすでに登録されています' };

    const sourceIndex = source.container.findIndex(link => link.id === source.link.id);
    if (sourceIndex < 0) return { changed: false };

    const [movedLink] = source.container.splice(sourceIndex, 1);
    movedLink.updatedAt = now();
    destination.container.push(movedLink);
    if (destination.subcategory) expandedCategoryIds.add(destination.category.id);

    return {
      changed: true,
      message: `「${movedLink.name}」を「${destination.label}」へ移動しました`
    };
  }

  function handleDragStart(event) {
    const handle = event.target.closest('.drag-handle');
    if (!managementMode || !handle) {
      event.preventDefault();
      return;
    }

    dragState = {
      type: handle.dataset.dragType,
      categoryId: handle.dataset.categoryId || null,
      subcategoryId: handle.dataset.subcategoryId || null,
      linkId: handle.dataset.linkId || null
    };

    handle.closest('.sortable-item')?.classList.add('dragging');
    if (dragState.type === 'link') markLinkDropTargets();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(dragState));
  }

  function handleDragOver(event) {
    if (!dragState) return;
    const target = getDragDropTarget(event);
    if (!isValidDropTarget(target)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.drag-over').forEach(element => element.classList.remove('drag-over'));
    target.classList.add('drag-over');
  }

  function handleDrop(event) {
    if (!dragState) return;
    const target = getDragDropTarget(event);
    if (!isValidDropTarget(target)) return;

    event.preventDefault();
    let changed = false;
    let message = '';

    if (dragState.type === 'category') {
      changed = reorderById(data.categories, dragState.categoryId, target.dataset.categoryId);
      message = '並び順を変更しました';
    }

    if (['subcategory', 'manager-subcategory'].includes(dragState.type) && target.dataset.categoryId === dragState.categoryId) {
      changed = reorderById(getCategory(dragState.categoryId).subcategories, dragState.subcategoryId, target.dataset.subcategoryId);
      message = '並び順を変更しました';
    }

    if (dragState.type === 'link') {
      if (target.dataset.dropType === 'link') {
        const location = findLinkLocation(dragState.categoryId, dragState.subcategoryId || null, dragState.linkId);
        changed = reorderById(location.container, dragState.linkId, target.dataset.linkId);
        message = '並び順を変更しました';
      } else {
        const result = moveLinkToSidebarTarget(target);
        changed = result.changed;
        message = result.message || '';
      }
    }

    if (changed) {
      saveData();
      if (elements.categoryManagerDialog.open) renderCategoryManager();
      render();
      showToast(message);
    } else if (message) {
      showToast(message);
    }

    dragState = null;
    clearDragStyles();
  }

  function handleDragEnd() {
    dragState = null;
    clearDragStyles();
  }

  function getSelectedImageMode() {
    return document.querySelector('input[name="imageMode"]:checked')?.value || 'auto';
  }

  function setSelectedImageMode(mode) {
    const radio = document.querySelector(`input[name="imageMode"][value="${mode}"]`);
    if (radio) radio.checked = true;
  }

  function refreshImageSettingsUI() {
    const isEditing = Boolean(elements.editingLinkId.value);
    const mode = getSelectedImageMode();

    elements.imageModeControls.hidden = !isEditing;
    elements.imagePreviewPanel.hidden = !isEditing;
    elements.customImageField.hidden = !isEditing || mode !== 'custom';
    elements.imageSettingsHelp.textContent = isEditing
      ? '通常は「自動」で大丈夫です。必要なサイトだけ取得方法を変更できます。'
      : '追加時はURLから自動判定します。画像設定は保存後の編集画面で変更できます。';

    if (isEditing) updateImagePreview();
  }

  function updateImagePreview() {
    const previewData = {
      url: elements.siteUrlInput.value.trim(),
      imageUrl: elements.siteImageInput.value.trim(),
      imageMode: getSelectedImageMode()
    };
    const image = resolveImage(previewData);

    elements.imagePreviewWrap.className = `image-preview-wrap${image.type === 'favicon' ? ' favicon-mode' : ''}`;
    elements.imagePreviewWrap.innerHTML = '';
    elements.imagePreviewMessage.textContent = '';

    if (!image.url) {
      elements.imagePreviewMessage.textContent =
        image.type === 'custom' ? '画像URLを入力してください。' :
        image.type === 'youtube' ? 'YouTube動画のURLを入力してください。' :
        'プレビューできるURLを入力してください。';
      return;
    }

    const img = document.createElement('img');
    img.src = image.url;
    img.alt = '';
    img.addEventListener('error', () => {
      elements.imagePreviewWrap.classList.add('image-error');
      img.remove();
      elements.imagePreviewMessage.textContent = '画像を読み込めませんでした。URLや取得方法を確認してください。';
    });
    elements.imagePreviewWrap.append(img);

    const labels = {
      custom: '画像URLを使用',
      youtube: 'YouTubeサムネイルを使用',
      favicon: 'faviconを中央表示'
    };
    elements.imagePreviewMessage.textContent = labels[image.type] || '';
  }

  elements.categoryList.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;

    const { action, categoryId, subcategoryId } = button.dataset;
    const category = getCategory(categoryId);
    const subcategory = getSubcategory(category, subcategoryId);

    if (action === 'select-favorites') {
      selection = { type: 'favorites', categoryId: null, subcategoryId: null };
    }

    if (action === 'select-category') {
      selection = { type: 'category', categoryId, subcategoryId: null };
      if (category.subcategories.length) {
        expandedCategoryIds.has(categoryId)
          ? expandedCategoryIds.delete(categoryId)
          : expandedCategoryIds.add(categoryId);
      }
    }

    if (action === 'select-subcategory') {
      selection = { type: 'subcategory', categoryId, subcategoryId };
    }

    if (action === 'manage-category') openCategoryManager(categoryId);


    render();
  });

  elements.linkList.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;

    const { action, categoryId, subcategoryId, linkId, url } = button.dataset;
    const location = findLinkLocation(categoryId, subcategoryId || null, linkId);

    if (action === 'copy-link') {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const area = document.createElement('textarea');
        area.value = url;
        document.body.append(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      showToast('リンクをコピーしました');
      return;
    }

    if (!location.link) return;

    if (action === 'toggle-favorite') {
      location.link.favorite = !location.link.favorite;
      location.link.updatedAt = now();
      saveData();
      renderLinks();
    }

    if (action === 'edit-link') {
      openLinkDialog(location.link, categoryId, subcategoryId || null);
    }

    if (action === 'delete-link' && confirm(`「${location.link.name}」を削除しますか？`)) {
      location.container.splice(location.container.findIndex(item => item.id === linkId), 1);
      saveData();
      renderLinks();
    }
  });

  function renderCategoryManager() {
    const category = getCategory(elements.managerCategoryId.value);
    if (!category) return;

    elements.managerSubcategoryEmpty.hidden = category.subcategories.length > 0;
    elements.managerSubcategoryList.innerHTML = category.subcategories.map(subcategory => `
      <div class="manager-subcategory-row sortable-item" data-drop-type="manager-subcategory" data-category-id="${category.id}" data-subcategory-id="${subcategory.id}">
        <button class="manager-drag-handle drag-handle" draggable="true" data-drag-type="manager-subcategory" data-category-id="${category.id}" data-subcategory-id="${subcategory.id}" title="ドラッグして並び替え" aria-label="${escapeHtml(subcategory.name)}を並び替え">☰</button>
        <span class="manager-subcategory-name">${escapeHtml(subcategory.name)}</span>
        <button class="small-icon-button" type="button" data-manager-action="edit-subcategory" data-subcategory-id="${subcategory.id}" title="名前を変更">✎</button>
        <button class="small-icon-button danger" type="button" data-manager-action="delete-subcategory" data-subcategory-id="${subcategory.id}" title="削除">×</button>
      </div>`).join('');
  }

  function openCategoryManager(categoryId) {
    const category = getCategory(categoryId);
    if (!category) return;
    elements.managerCategoryId.value = category.id;
    elements.managerCategoryNameInput.value = category.name;
    renderCategoryManager();
    elements.categoryManagerDialog.showModal();
    elements.managerCategoryNameInput.focus();
  }

  function populateLinkLocationSelects(categoryId, subcategoryId = null) {
    elements.siteCategorySelect.innerHTML = data.categories.map(category =>
      `<option value="${category.id}">${escapeHtml(category.name)}</option>`
    ).join('');
    elements.siteCategorySelect.value = categoryId;
    updateLinkSubcategoryOptions(subcategoryId);
  }

  function updateLinkSubcategoryOptions(selectedSubcategoryId = null) {
    const category = getCategory(elements.siteCategorySelect.value);
    elements.siteSubcategorySelect.innerHTML = `
      <option value="">サブカテゴリなし（ジャンル直下）</option>
      ${(category?.subcategories || []).map(subcategory =>
        `<option value="${subcategory.id}">${escapeHtml(subcategory.name)}</option>`
      ).join('')}`;
    elements.siteSubcategorySelect.value = selectedSubcategoryId || '';
  }

  function openCategoryDialog(category = null) {
    elements.categoryDialogTitle.textContent = 'ジャンルを追加';
    elements.categoryNameInput.value = '';
    elements.editingCategoryId.value = '';
    elements.categoryDialog.showModal();
    elements.categoryNameInput.focus();
  }

  function openSubcategoryDialog(categoryId, subcategory = null) {
    elements.subcategoryDialogTitle.textContent = subcategory ? 'サブカテゴリを編集' : 'サブカテゴリを追加';
    elements.subcategoryNameInput.value = subcategory?.name || '';
    elements.subcategoryCategoryId.value = categoryId;
    elements.editingSubcategoryId.value = subcategory?.id || '';
    elements.subcategoryDialog.showModal();
    elements.subcategoryNameInput.focus();
  }

  function openLinkDialog(link = null, categoryId = selection.categoryId, subcategoryId = selection.type === 'subcategory' ? selection.subcategoryId : null) {
    const isEditing = Boolean(link);

    elements.linkDialogTitle.textContent = isEditing ? 'サイトを編集' : 'サイトを追加';
    elements.siteNameInput.value = link?.name || '';
    elements.siteUrlInput.value = link?.url || '';
    elements.siteMemoInput.value = link?.memo || '';
    elements.siteImageInput.value = link?.imageUrl || '';
    elements.siteFavoriteInput.checked = Boolean(link?.favorite);
    elements.editingLinkId.value = link?.id || '';
    elements.linkDialog.dataset.categoryId = categoryId;
    elements.linkDialog.dataset.subcategoryId = subcategoryId || '';
    elements.linkLocationFields.hidden = !isEditing;
    // 追加時は非表示の移動先セレクトを無効化し、ブラウザの入力検証対象から外す。
    // 編集時だけ有効化して、ジャンル・サブカテゴリの移動先として使用する。
    elements.siteCategorySelect.disabled = !isEditing;
    elements.siteSubcategorySelect.disabled = !isEditing;
    if (isEditing) populateLinkLocationSelects(categoryId, subcategoryId);

    setSelectedImageMode(isEditing ? (link.imageMode || (link.imageUrl ? 'custom' : 'auto')) : 'auto');
    refreshImageSettingsUI();

    elements.linkDialog.showModal();
    elements.siteNameInput.focus();
  }

  elements.categoryForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = elements.categoryNameInput.value.trim();
    if (!name) return;

    data.categories.push({ id: createId(), name, subcategories: [], links: [] });

    saveData();
    elements.categoryDialog.close();
    render();
  });

  elements.subcategoryForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = elements.subcategoryNameInput.value.trim();
    if (!name) return;

    const category = getCategory(elements.subcategoryCategoryId.value);
    const id = elements.editingSubcategoryId.value;

    if (id) getSubcategory(category, id).name = name;
    else category.subcategories.push({ id: createId(), name, links: [] });

    expandedCategoryIds.add(category.id);
    saveData();
    elements.subcategoryDialog.close();
    if (elements.categoryManagerDialog.open) renderCategoryManager();
    render();
  });

  function saveLinkFromDialog() {
    const originalCategoryId = elements.linkDialog.dataset.categoryId;
    const originalSubcategoryId = elements.linkDialog.dataset.subcategoryId || null;
    const editingId = elements.editingLinkId.value;

    if (!originalCategoryId) {
      alert('保存先のジャンルを取得できませんでした。いったん閉じて、ジャンルを選び直してください。');
      return false;
    }

    const originalLocation = findLinkLocation(originalCategoryId, originalSubcategoryId, editingId);
    const link = originalLocation.link;
    const categoryId = editingId ? elements.siteCategorySelect.value : originalCategoryId;
    const subcategoryId = editingId ? (elements.siteSubcategorySelect.value || null) : originalSubcategoryId;
    const category = getCategory(categoryId);
    const subcategory = subcategoryId ? getSubcategory(category, subcategoryId) : null;
    const targetContainer = subcategoryId ? subcategory?.links : category?.links;

    if (!Array.isArray(targetContainer)) {
      alert('保存先を取得できませんでした。ジャンルまたはサブカテゴリを選び直してください。');
      return false;
    }

    const imageMode = editingId ? getSelectedImageMode() : 'auto';
    const values = {
      name: elements.siteNameInput.value.trim(),
      url: elements.siteUrlInput.value.trim(),
      memo: elements.siteMemoInput.value.trim(),
      imageUrl: imageMode === 'custom' ? elements.siteImageInput.value.trim() : '',
      imageMode,
      favorite: elements.siteFavoriteInput.checked,
      updatedAt: now()
    };

    if (link) {
      Object.assign(link, values);
      const moved = originalCategoryId !== categoryId || (originalSubcategoryId || '') !== (subcategoryId || '');
      if (moved) {
        const index = originalLocation.container?.findIndex(item => item.id === editingId) ?? -1;
        if (index >= 0) originalLocation.container.splice(index, 1);
        targetContainer.push(link);
      }
    } else {
      targetContainer.push({ id: createId(), ...values, createdAt: now() });
    }

    saveData();
    elements.linkDialog.close();
    render();
    showToast(editingId ? 'サイトを更新しました' : 'サイトを保存しました');
    return true;
  }

  elements.linkForm.addEventListener('submit', event => {
    event.preventDefault();

    try {
      saveLinkFromDialog();
    } catch (error) {
      console.error('サイトを保存できませんでした。', error);
      alert('サイトを保存できませんでした。ページを再読み込みして、もう一度お試しください。');
    }
  });

  elements.linkSaveButton?.addEventListener('click', event => {
    event.stopPropagation();
  });

  elements.categoryManagerForm.addEventListener('submit', event => {
    event.preventDefault();
    const category = getCategory(elements.managerCategoryId.value);
    const name = elements.managerCategoryNameInput.value.trim();
    if (!category || !name) return;
    category.name = name;
    saveData();
    elements.categoryManagerDialog.close();
    render();
    showToast('ジャンルを更新しました');
  });

  elements.managerAddSubcategoryButton.addEventListener('click', () => {
    openSubcategoryDialog(elements.managerCategoryId.value);
  });

  elements.managerDeleteCategoryButton.addEventListener('click', () => {
    const category = getCategory(elements.managerCategoryId.value);
    if (!category) return;
    if (!confirm(`「${category.name}」を削除しますか？\n登録されているサイトとサブカテゴリも削除されます。`)) return;
    data.categories = data.categories.filter(item => item.id !== category.id);
    selection = { type: 'favorites', categoryId: null, subcategoryId: null };
    saveData();
    elements.categoryManagerDialog.close();
    render();
    showToast('ジャンルを削除しました');
  });

  elements.managerSubcategoryList.addEventListener('click', event => {
    const button = event.target.closest('[data-manager-action]');
    if (!button) return;
    const category = getCategory(elements.managerCategoryId.value);
    const subcategory = getSubcategory(category, button.dataset.subcategoryId);
    if (!subcategory) return;

    if (button.dataset.managerAction === 'edit-subcategory') {
      openSubcategoryDialog(category.id, subcategory);
    }

    if (button.dataset.managerAction === 'delete-subcategory') {
      if (!confirm(`「${subcategory.name}」を削除しますか？\n登録されているサイトも削除されます。`)) return;
      category.subcategories = category.subcategories.filter(item => item.id !== subcategory.id);
      if (selection.subcategoryId === subcategory.id) selection = { type: 'category', categoryId: category.id, subcategoryId: null };
      saveData();
      renderCategoryManager();
      render();
      showToast('サブカテゴリを削除しました');
    }
  });

  elements.siteCategorySelect.addEventListener('change', () => updateLinkSubcategoryOptions());

  elements.managementToggleButton.addEventListener('click', () => {
    managementMode = !managementMode;
    render();
  });

  elements.addCategoryButton.addEventListener('click', () => openCategoryDialog());

  // ===== テスト用：本実装時はこのブロックとHTML側のボタンをコメントアウトできます =====
  elements.resetDataButton?.addEventListener('click', () => {
    const confirmed = confirm(
      '保存されているデータを削除して、初期状態に戻しますか？\n\n' +
      'バックアップを作成していない場合、元に戻すことはできません。'
    );
    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    location.reload();
  });
  // ===== テスト用ここまで =====

  elements.addLinkButton.addEventListener('click', () => {
    if (selection.type !== 'favorites') openLinkDialog();
  });

  elements.searchInput.addEventListener('input', render);

  document.querySelectorAll('[data-image-size]').forEach(button => {
    button.addEventListener('click', () => {
      settings.imageSize = button.dataset.imageSize;
      saveSettings();
      applyImageSizeSetting();
    });
  });

  document.querySelectorAll('input[name="imageMode"]').forEach(radio => {
    radio.addEventListener('change', refreshImageSettingsUI);
  });

  elements.siteUrlInput.addEventListener('input', () => {
    if (elements.editingLinkId.value) updateImagePreview();
  });

  elements.siteImageInput.addEventListener('input', () => {
    if (elements.editingLinkId.value) updateImagePreview();
  });

  elements.categoryList.addEventListener('dragstart', handleDragStart);
  elements.categoryList.addEventListener('dragover', handleDragOver);
  elements.categoryList.addEventListener('drop', handleDrop);
  elements.categoryList.addEventListener('dragend', handleDragEnd);
  elements.linkList.addEventListener('dragstart', handleDragStart);
  elements.linkList.addEventListener('dragover', handleDragOver);
  elements.linkList.addEventListener('drop', handleDrop);
  elements.linkList.addEventListener('dragend', handleDragEnd);
  elements.managerSubcategoryList.addEventListener('dragstart', handleDragStart);
  elements.managerSubcategoryList.addEventListener('dragover', handleDragOver);
  elements.managerSubcategoryList.addEventListener('drop', handleDrop);
  elements.managerSubcategoryList.addEventListener('dragend', handleDragEnd);

  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => $(button.dataset.closeDialog).close());
  });

  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });

  elements.exportButton.addEventListener('click', () => {
    const backup = {
      ...data,
      settings
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `eorzea-link-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    showToast('バックアップを書き出しました');
  });

  elements.importInput.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const imported = normalizeData(parsed);

      if (!confirm('現在のデータを、選択したバックアップで置き換えますか？')) return;

      data = imported;
      if (parsed.settings?.imageSize === 'large') {
        settings = { imageSize: 'large-wide' };
        saveSettings();
      } else if (['large-wide', 'large-square', 'small', 'none'].includes(parsed.settings?.imageSize)) {
        settings = { imageSize: parsed.settings.imageSize };
        saveSettings();
      }

      selection = { type: 'favorites', categoryId: null, subcategoryId: null };
      expandedCategoryIds = new Set(data.categories.filter(category => category.subcategories.length).map(category => category.id));
      saveData();
      render();
      showToast('バックアップを復元しました');
    } catch {
      alert('JSONファイルを読み込めませんでした。');
    } finally {
      event.target.value = '';
    }
  });


  elements.bookmarkImportInput.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const folders = parseBookmarkHtml(await file.text());
      bookmarkImportState = { fileName: file.name, folders, selectedIds: new Set() };
      elements.bookmarkImportFileName.textContent = file.name;
      renderBookmarkFolderTree();
      elements.bookmarkImportDialog.showModal();
    } catch (error) {
      console.error(error);
      alert('ブックマークHTMLを読み込めませんでした。Chromeなどから書き出したHTMLファイルを選択してください。');
      resetBookmarkImportDialog();
    } finally {
      event.target.value = '';
    }
  });

  elements.bookmarkFolderTree.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-bookmark-folder-id]');
    if (!checkbox) return;
    if (checkbox.checked) bookmarkImportState.selectedIds.add(checkbox.dataset.bookmarkFolderId);
    else bookmarkImportState.selectedIds.delete(checkbox.dataset.bookmarkFolderId);
    updateBookmarkImportSummary();
  });

  elements.bookmarkClearSelectionButton.addEventListener('click', () => {
    bookmarkImportState.selectedIds.clear();
    renderBookmarkFolderTree();
  });

  elements.bookmarkImportForm.addEventListener('submit', event => {
    event.preventDefault();
    const folders = getEffectiveSelectedBookmarkFolders();
    if (!folders.length) return;

    const totalLinks = folders.reduce((total, folder) => total + countBookmarkLinks(folder), 0);
    if (!confirm(`${folders.length}フォルダ・最大${totalLinks}件を、新しい「インポート YYYY-MM-DD」ジャンルへ取り込みますか？\n\n同じURLがすでに登録されている場合はスキップします。`)) return;

    const existingUrls = new Set(allLinks().map(({ link }) => normalizeBookmarkUrl(link.url)).filter(Boolean));
    const result = importBookmarkFoldersIntoNewCategory(folders, existingUrls);

    saveData();
    elements.bookmarkImportDialog.close();
    resetBookmarkImportDialog();

    if (result.category) {
      selection = { type: 'category', categoryId: result.category.id, subcategoryId: null };
    }

    render();
    showToast(result.added
      ? `${result.category.name}に${result.added}件取り込みました${result.skipped ? `（${result.skipped}件スキップ）` : ''}`
      : `追加できる新しいサイトはありませんでした${result.skipped ? `（${result.skipped}件スキップ）` : ''}`);
  });


  render();
})();
