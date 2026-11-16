import { promptModal, showToast } from '../../utils/dialog.js';

export function render(container) {
  container.innerHTML = `
    <div class="goals-module" style="padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-6);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h1 style="color: var(--text-primary); font-size: 1.5rem; font-weight: 600; margin: 0;">Savings Goals</h1>
        <button class="btn btn-primary" id="add-goal-btn">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
          Add New Goal
        </button>
      </div>

      <div class="goals-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-6);" id="goals-list">
        <!-- Goal Cards will be injected here -->
      </div>
    </div>

    <!-- Modal for Adding New Goal -->
    <div id="goal-modal" class="modal-overlay" style="display: none;">
      <div class="modal-content">
        <h2 style="color: var(--text-primary); margin-top: 0; margin-bottom: var(--space-4);">Add New Goal</h2>
        <form id="add-goal-form" style="display: flex; flex-direction: column; gap: var(--space-4);">
          <div>
            <label style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--space-2); display: block;">Goal Name</label>
            <input type="text" id="goal-name" class="input-field" placeholder="e.g. Vacation" required />
          </div>
          <div>
            <label style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--space-2); display: block;">Target Amount ($)</label>
            <input type="number" id="goal-target" class="input-field" placeholder="5000" min="1" required />
          </div>
          <div>
            <label style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: var(--space-2); display: block;">Initial Saved ($)</label>
            <input type="number" id="goal-saved" class="input-field" placeholder="0" min="0" />
          </div>
          <div style="display: flex; justify-content: flex-end; gap: var(--space-3); margin-top: var(--space-2);">
            <button type="button" class="btn btn-ghost" id="close-goal-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Goal</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Internal state
  let goals = [
    { id: 1, name: 'Emergency Fund', target: 10000, saved: 4500, icon: '🛡️' },
    { id: 2, name: 'Vacation', target: 3000, saved: 1200, icon: '✈️' },
    { id: 3, name: 'New Car', target: 20000, saved: 5000, icon: '🚗' },
  ];

  const renderGoals = () => {
    const list = container.querySelector('#goals-list');
    list.innerHTML = goals.map(g => {
      const progressPercent = Math.min(100, Math.round((g.saved / g.target) * 100));
      return `
        <div class="glass-card" style="display: flex; flex-direction: column; gap: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <div class="avatar" style="background: var(--bg-surface); border: 1px solid var(--border-subtle); color: var(--text-primary); font-size: 1.25rem;">
                ${g.icon || '🎯'}
              </div>
              <div>
                <h3 style="color: var(--text-primary); font-weight: 500; font-size: 1.125rem; margin: 0;">${g.name}</h3>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0;">$${g.saved.toLocaleString()} / $${g.target.toLocaleString()}</p>
              </div>
            </div>
            <span class="badge badge-info">${progressPercent}%</span>
          </div>
          
          <div style="width: 100%; background: var(--bg-surface); height: 8px; border-radius: 4px; overflow: hidden; border: 1px solid var(--border-subtle);">
            <div style="height: 100%; width: ${progressPercent}%; background: var(--accent-primary); border-radius: 4px; transition: width 0.5s ease-in-out;"></div>
          </div>
          
          <button class="btn btn-secondary add-funds-btn" data-id="${g.id}" style="width: 100%; margin-top: var(--space-2);">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
            Add Funds
          </button>
        </div>
      `;
    }).join('');

    // Attach events for Add Funds
    container.querySelectorAll('.add-funds-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        const goal = goals.find(g => g.id === id);
        if (goal) {
          const amount = await promptModal({
            title: `Add Funds to ${goal.name}`,
            message: `Enter amount to contribute (current: $${goal.saved.toLocaleString()} / $${goal.target.toLocaleString()}):`,
            defaultValue: '100',
            placeholder: 'Amount ($)',
            confirmText: 'Add Funds',
          });
          if (amount && !isNaN(parseFloat(amount))) {
            const added = parseFloat(amount);
            goal.saved += added;
            renderGoals();
            showToast(`Added $${added.toLocaleString()} to ${goal.name}!`, 'success');
          }
        }
      });
    });
  };

  renderGoals();

  const modal = container.querySelector('#goal-modal');
  container.querySelector('#add-goal-btn').addEventListener('click', () => {
    modal.style.display = 'flex';
  });
  container.querySelector('#close-goal-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  
  const form = container.querySelector('#add-goal-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = container.querySelector('#goal-name').value;
    const target = parseFloat(container.querySelector('#goal-target').value);
    const saved = parseFloat(container.querySelector('#goal-saved').value) || 0;
    
    goals.push({ id: Date.now(), name, target, saved, icon: '🎯' });
    renderGoals();
    modal.style.display = 'none';
    e.target.reset();
  });
}
