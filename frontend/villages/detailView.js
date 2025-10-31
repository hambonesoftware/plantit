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
    this.backButton = root.querySelector('[data-action="detail-back"]');

    this.name = root.querySelector('[data-role="detail-name"]');
    this.climate = root.querySelector('[data-role="detail-climate"]');
    this.description = root.querySelector('[data-role="detail-description"]');
    this.established = root.querySelector('[data-role="detail-established"]');
    this.plants = root.querySelector('[data-role="detail-plants"]');
    this.health = root.querySelector('[data-role="detail-health"]');
    this.irrigation = root.querySelector('[data-role="detail-irrigation"]');
    this.content = root.querySelector('[data-role="detail-content"]');

    if (this.retryButton) {
      this.retryButton.addEventListener('click', () => {
        this.viewModel.retry();
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
  }

  renderLoading() {
    this.toggleVisibility({
      placeholder: false,
      loading: true,
      error: false,
      content: false,
    });
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

    this.toggleVisibility({
      placeholder: false,
      loading: false,
      error: false,
      content: true,
    });
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
}
