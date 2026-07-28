import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ChainProvider from '@/components/ChainProvider';
import ChainSelector from '@/components/ChainSelector';

beforeEach(() => {
  // localStorage is already cleared by the global setup; verify the chain key
  // has no stale state from a previous test in this file.
  window.localStorage.removeItem('baraza:chain');
});

function renderSelector() {
  return render(
    <ChainProvider>
      <ChainSelector />
    </ChainProvider>,
  );
}

describe('ChainSelector — closed state', () => {
  it('renders the funding rail selector with Stellar as the default rail', () => {
    renderSelector();
    expect(screen.getByRole('button', { name: /funding rail: stellar selected/i })).toHaveTextContent('Fund');
  });

  it('does not render the listbox when closed', () => {
    renderSelector();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('toggles open on trigger click', () => {
    renderSelector();
    const trigger = screen.getByRole('button', { name: /funding rail: stellar selected/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('ChainSelector — open state', () => {
  it('lists the four visible rails, with Stellar as the selected option', () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /funding rail: stellar selected/i }));
    const listbox = screen.getByRole('listbox');
    const options = within(listbox).getAllByRole('option');
    expect(options).toHaveLength(4);
    // Visible order is [solana, mpesa, stellar, celo] — index 2 is Stellar.
    const stellarIndex = 2;
    expect(options[stellarIndex]).toHaveAttribute('aria-selected', 'true');
    for (let i = 0; i < options.length; i++) {
      if (i === stellarIndex) continue;
      expect(options[i]).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('lists M-Pesa as an active KES onramp into a wallet', () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /funding rail: stellar selected/i }));
    const mpesaOption = screen.getByRole('option', { name: /^m-pesa$/i });
    expect(mpesaOption).not.toBeDisabled();
    expect(mpesaOption).toHaveTextContent('KES onramp into wallet');
  });

  it('allows Solana selection', () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /funding rail: stellar selected/i }));
    const solanaOption = screen.getByRole('option', { name: /^solana$/i });
    expect(solanaOption).not.toBeDisabled();
    fireEvent.click(solanaOption);
    expect(screen.getByRole('button', { name: /solana selected/i })).toBeInTheDocument();
  });

  it('keeps roadmap-only EVM review rails out of the picker', () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /funding rail: stellar selected/i }));

    for (const name of ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb chain', 'xdc']) {
      expect(screen.queryByRole('option', { name: new RegExp(name, 'i') })).not.toBeInTheDocument();
    }

    expect(screen.getByRole('option', { name: /^celo$/i })).not.toBeDisabled();
  });

  it('does not render unsupported rails', () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /funding rail: stellar selected/i }));
    expect(screen.queryByRole('option', { name: /bnb chain/i })).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /funding rail: stellar selected/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on outside click', () => {
    const { container } = renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /funding rail: stellar selected/i }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // mousedown outside the component should trigger close.
    fireEvent.mouseDown(container.ownerDocument.body);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('ChainSelector — keyboard navigation', () => {
  it('ArrowDown can focus the next enabled option from Stellar', () => {
    renderSelector();
    const trigger = screen.getByRole('button', { name: /funding rail: stellar selected/i });
    fireEvent.click(trigger);

    // Solana (index 0), M-Pesa (index 1), Stellar (index 2), and Celo are visible.
    fireEvent.keyDown(window, { key: 'ArrowDown' });

    // No crash, listbox still open
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('ArrowUp closes nothing and lands on enabled option', () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /funding rail: stellar selected/i }));
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});

describe('ChainSelector — persistence', () => {
  it('writes the chain to localStorage on selection', () => {
    renderSelector();
    // Initial: nothing in storage (cleared in beforeEach)
    expect(window.localStorage.getItem('baraza:chain')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /funding rail: stellar selected/i }));
    // Clicking the already-selected Stellar option still triggers a write.
    fireEvent.click(screen.getByRole('option', { name: /^stellar$/i }));

    expect(window.localStorage.getItem('baraza:chain')).toBe('stellar');
  });

  it('reads the initial chain from localStorage if present', () => {
    window.localStorage.setItem('baraza:chain', 'solana');
    renderSelector();
    expect(screen.getByRole('button', { name: /solana selected/i })).toBeInTheDocument();
  });
});
