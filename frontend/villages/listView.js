import { copyDiagnosticsToClipboard } from '../services/diagnostics.js';
import { showToast } from '../services/toast.js';
import { formatHealthScore } from './shared.js';

/**
 * Render and manage the villages list panel.
 */
export class VillageListView {
  /**
   * @param {HTMLElement} root
   * @param {import('./viewModels.js').VillageListViewModel} viewModel
   * @param {{ onSelect?: (villageId: string | null) => void }} [options]
   */
  constructor(root, viewModel, options = {}) {
    this.root = root;
    this.viewModel = viewModel;
    this.onSelect = options.onSelect ?? (() => {});
    this._bannerTimers = new Map();

    this.searchForm = root.querySelector('[data-role="village-search-form"]');
    this.searchInput = root.querySelector('[data-role="village-search"]');
    this.listElement = root.querySelector('[data-role="village-list"]');
    this.loadingMessage = root.querySelector('[data-role="village-loading"]');
    this.emptyMessage = root.querySelector('[data-role="village-empty"]');
    this.errorPanel = root.querySelector('[data-role="village-error"]');
    this.errorMessage = root.querySelector('[data-role="village-error-message"]');
    this.retryButton = root.querySelector('[data-action="retry"]');
    this.copyButton = root.querySelector('[data-action="villages-copy-error"]');
    this.refreshButton = root.querySelector('[data-action="refresh"]');
    this._currentErrorDetail = '';

    if (this.searchForm) {
      this.searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const term = this.searchInput ? this.searchInput.value.trim() : '';
        this.viewModel.applyFilters({ searchTerm: term });
      });
    }

    if (this.refreshButton) {
      this.refreshButton.addEventListener('click', () => {
        this.viewModel.retry();
      });
    }

    if (this.retryButton) {
      this.retryButton.addEventListener('click', () => {
        this.viewModel.retry();
      });
    }

    if (this.copyButton) {
      this.copyButton.addEventListener('click', async () => {
        const success = await copyDiagnosticsToClipboard(this._currentErrorDetail);
        if (success) {
          showToast({ message: 'Error details copied to clipboard.', tone: 'success' });
        } else {
          showToast({ message: 'Unable to copy error details. Copy manually if needed.', tone: 'warning' });
        }
      });
    }

    this.unsubscribe = this.viewModel.subscribe((state) => {
      this.render(state);
    });
  }

  /**
   * @param {import('./viewModels.js').VillageListState} state
   */
  render(state) {
    this.root.dataset.status = state.status;
    if (this.searchInput && state.filters) {
      this.searchInput.value = state.filters.searchTerm ?? '';
    }

    switch (state.status) {
      case 'idle':
      case 'loading':
        this.renderLoading();
        break;
      case 'ready':
        this.renderReady(state);
        break;
      case 'error':
        this.renderError(state);
        break;
      default:
        break;
    }
  }

  renderLoading() {
    this._clearBannerTimers();
    if (this.loadingMessage) {
      this.loadingMessage.hidden = false;
    }
    if (this.listElement) {
      this.listElement.hidden = true;
      this.listElement.replaceChildren();
    }
    if (this.emptyMessage) {
      this.emptyMessage.hidden = true;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }
    this._updateErrorContext(null, null);
  }

  /**
   * @param {import('./viewModels.js').VillageListState} state
   */
  renderReady(state) {
    this._clearBannerTimers();
    if (this.loadingMessage) {
      this.loadingMessage.hidden = true;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = true;
    }
    this._updateErrorContext(null, null);

    const villages = Array.isArray(state.villages) ? state.villages : [];
    if (!this.listElement || !this.emptyMessage) {
      return;
    }

    if (villages.length === 0) {
      this.listElement.hidden = true;
      this.listElement.replaceChildren();
      this.emptyMessage.hidden = false;
      return;
    }

    this.emptyMessage.hidden = true;
    this.listElement.hidden = false;

    const items = villages.map((village) => {
      const item = document.createElement('li');
      item.className = 'villages-list-item';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'villages-list-button';
      button.dataset.villageId = village.id;
      button.setAttribute('role', 'option');
      button.addEventListener('click', () => {
        this.onSelect(village.id);
      });

      const name = document.createElement('span');
      name.className = 'villages-list-name';
      name.textContent = village.name;

      const meta = document.createElement('span');
      meta.className = 'villages-list-meta';
      meta.textContent = `${village.plantCount} plants • ${village.climate}`;

      const health = document.createElement('span');
      health.className = 'villages-list-health';
      health.textContent = formatHealthScore(village.healthScore);

      if (village.id === state.selectedVillageId) {
        button.dataset.selected = 'true';
        button.setAttribute('aria-current', 'true');
      } else {
        button.dataset.selected = 'false';
        button.removeAttribute('aria-current');
      }

      this._registerBannerCycle(button, village.bannerImageUrls);

      button.append(name, meta, health);
      item.append(button);
      return item;
    });

    this.listElement.replaceChildren(...items);
  }

  /**
   * @param {import('./viewModels.js').VillageListState} state
   */
  renderError(state) {
    this._clearBannerTimers();
    if (this.loadingMessage) {
      this.loadingMessage.hidden = true;
    }
    if (this.emptyMessage) {
      this.emptyMessage.hidden = true;
    }
    if (this.listElement) {
      this.listElement.hidden = true;
      this.listElement.replaceChildren();
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = false;
    }
    if (this.errorMessage) {
      this.errorMessage.textContent = state.error?.message ?? 'Unable to load villages.';
    }
    this._updateErrorContext(state.error?.detail ?? null, state.error?.category ?? null);
  }

  _updateErrorContext(detail, category) {
    this._currentErrorDetail = typeof detail === 'string' ? detail : '';
    if (this.copyButton) {
      this.copyButton.disabled = !this._currentErrorDetail;
    }
    if (this.errorPanel) {
      if (category) {
        this.errorPanel.dataset.category = category;
      } else {
        delete this.errorPanel.dataset.category;
      }
    }
  }

  _clearBannerTimers() {
    for (const timer of this._bannerTimers.values()) {
      window.clearInterval(timer);
    }
    this._bannerTimers.clear();
  }

  _registerBannerCycle(button, images) {
    if (!(button instanceof HTMLElement)) {
      return;
    }
    const sanitized = Array.isArray(images)
      ? images
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
      : [];
    if (sanitized.length === 0) {
      button.dataset.hasBanner = 'false';
      button.style.removeProperty('--village-banner-image');
      return;
    }
    let index = 0;
    const applyImage = () => {
      button.style.setProperty('--village-banner-image', `url("${sanitized[index]}")`);
      button.dataset.hasBanner = 'true';
    };
    applyImage();
    if (sanitized.length === 1) {
      return;
    }
    const timer = window.setInterval(() => {
      index = (index + 1) % sanitized.length;
      applyImage();
    }, 6000);
    this._bannerTimers.set(button, timer);
  }
}
