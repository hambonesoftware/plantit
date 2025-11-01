import { copyDiagnosticsToClipboard } from '../services/diagnostics.js';
import { showToast } from '../services/toast.js';
import { formatDate, formatHealthScore } from './shared.js';

/**
 * View responsible for presenting a single village's detail panel.
 */
export class VillageDetailView {
  /**
   * @param {HTMLElement} root
   * @param {import('./viewModels.js').VillageDetailViewModel} viewModel
   * @param {{ onBack?: () => void }} [options]
   */
  constructor(root, viewModel, options = {}) {
    this.root = root;
    this.viewModel = viewModel;
    this.onBack = options.onBack ?? (() => {});

    this.placeholder = root.querySelector('[data-role="detail-placeholder"]');
    this.loading = root.querySelector('[data-role="detail-loading"]');
    this.errorPanel = root.querySelector('[data-role="detail-error"]');
    this.errorMessage = root.querySelector('[data-role="detail-error-message"]');
    this.retryButton = root.querySelector('[data-action="detail-retry"]');
    this.copyButton = root.querySelector('[data-action="detail-copy-error"]');
    this.backButton = root.querySelector('[data-action="detail-back"]');
    this._currentErrorDetail = '';

    this.name = root.querySelector('[data-role="detail-name"]');
    this.climate = root.querySelector('[data-role="detail-climate"]');
    this.description = root.querySelector('[data-role="detail-description"]');
    this.established = root.querySelector('[data-role="detail-established"]');
    this.plants = root.querySelector('[data-role="detail-plants"]');
    this.health = root.querySelector('[data-role="detail-health"]');
    this.irrigation = root.querySelector('[data-role="detail-irrigation"]');
    this.content = root.querySelector('[data-role="detail-content"]');
    this.hero = root.querySelector('[data-role="village-hero"]');
    this._heroTimer = null;

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

    if (this.backButton) {
      this.backButton.addEventListener('click', () => {
        this.onBack();
      });
    }

    this.unsubscribe = this.viewModel.subscribe((state) => {
      this.render(state);
    });
  }

  /**
   * @param {import('./viewModels.js').VillageDetailState} state
   */
  render(state) {
    this.root.dataset.status = state.status;
    switch (state.status) {
      case 'idle':
        this.renderIdle();
        break;
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

  renderIdle() {
    this.toggleVisibility({
      placeholder: true,
      loading: false,
      error: false,
      content: false,
    });
    this._updateErrorContext(null, null);
    this._setHeroImages([]);
  }

  renderLoading() {
    this.toggleVisibility({
      placeholder: false,
      loading: true,
      error: false,
      content: false,
    });
    this._updateErrorContext(null, null);
    this._setHeroImages([]);
  }

  /**
   * @param {import('./viewModels.js').VillageDetailState} state
   */
  renderReady(state) {
    const village = state.village;
    if (!village) {
      this.renderIdle();
      return;
    }

    if (this.name) {
      this.name.textContent = village.name;
    }
    if (this.climate) {
      this.climate.textContent = village.climate;
    }
    if (this.description) {
      this.description.textContent = village.description || 'No description provided yet.';
    }
    if (this.established) {
      this.established.textContent = formatDate(village.establishedAt);
    }
    if (this.plants) {
      this.plants.textContent = `${village.plantCount}`;
    }
    if (this.health) {
      this.health.textContent = formatHealthScore(village.healthScore);
    }
    if (this.irrigation) {
      this.irrigation.textContent = village.irrigationType || '—';
    }

    this._setHeroImages(village.bannerImageUrls || []);

    this.toggleVisibility({
      placeholder: false,
      loading: false,
      error: false,
      content: true,
    });
    this._updateErrorContext(null, null);
  }

  /**
   * @param {import('./viewModels.js').VillageDetailState} state
   */
  renderError(state) {
    if (this.errorMessage) {
      this.errorMessage.textContent = state.error?.message ?? 'Unable to load village details.';
    }
    this.toggleVisibility({
      placeholder: false,
      loading: false,
      error: true,
      content: false,
    });
    this._updateErrorContext(state.error?.detail ?? null, state.error?.category ?? null);
    this._setHeroImages([]);
  }

  toggleVisibility({ placeholder, loading, error, content }) {
    if (this.placeholder) {
      this.placeholder.hidden = !placeholder;
    }
    if (this.loading) {
      this.loading.hidden = !loading;
    }
    if (this.errorPanel) {
      this.errorPanel.hidden = !error;
    }
    if (this.content) {
      this.content.hidden = !content;
    }
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

  _setHeroImages(images) {
    if (this._heroTimer !== null) {
      window.clearInterval(this._heroTimer);
      this._heroTimer = null;
    }
    const hero = this.hero instanceof HTMLElement ? this.hero : null;
    if (!hero) {
      return;
    }
    const sanitized = Array.isArray(images)
      ? images
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
      : [];
    if (sanitized.length === 0) {
      hero.style.removeProperty('--village-hero-image');
      hero.dataset.hasBanner = 'false';
      return;
    }
    let index = 0;
    const apply = () => {
      hero.style.setProperty('--village-hero-image', `url("${sanitized[index]}")`);
      hero.dataset.hasBanner = 'true';
    };
    apply();
    if (sanitized.length > 1) {
      this._heroTimer = window.setInterval(() => {
        index = (index + 1) % sanitized.length;
        apply();
      }, 6000);
    }
  }
}
