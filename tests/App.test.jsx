/**
 * App.jsx — Integration Tests
 *
 * Tests the top-level MTGMonteCarloAnalyzer component covering:
 *   Initial render        – header, subtitle, core panels visible
 *   Data Source panel     – radio buttons, default selection, conditional upload UI
 *   Deck List panel       – textarea, placeholder text, Parse Deck button
 *   Parse Deck flow       – parseDeckList called, success path, failure path, error banner
 *   Run Simulation flow   – monteCarlo called, "Please parse a deck first" guard
 *   localStorage          – state persisted on change, state restored on mount
 *   Comparison mode       – toggle, dual inputs, Deck B parse flow, simulation guards
 *
 * Run:  npm test
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import MTGMonteCarloAnalyzer from '../src/App.jsx';

// ─── Global stubs (jsdom gaps) ────────────────────────────────────────────────

global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../src/simulation/monteCarlo.js', () => ({
  monteCarlo: vi.fn(() => ({})),
  buildCompleteDeck: vi.fn(() => []),
}));

vi.mock('../src/parser/deckParser.js', () => ({
  parseDeckList: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal parsed-deck object returned by a mocked successful parseDeckList call */
const MOCK_PARSED_DECK = {
  totalCards: 60,
  landCount: 24,
  lands: [
    {
      name: 'Forest',
      quantity: 24,
      isBasic: true,
      produces: ['G'],
      isFetch: false,
      entersTappedAlways: false,
    },
  ],
  spells: [],
  creatures: [],
  artifacts: [],
  rituals: [],
  rampSpells: [],
  exploration: [],
  errors: [],
};

/** Convenience: import the mocked module so tests can configure it per-test */
import { parseDeckList } from '../src/parser/deckParser.js';
import { monteCarlo } from '../src/simulation/monteCarlo.js';

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// =============================================================================
// 1 — Initial render
// =============================================================================
describe('Initial render', () => {
  it('renders without throwing', () => {
    expect(() => render(<MTGMonteCarloAnalyzer />)).not.toThrow();
  });

  it('displays the app title', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByText(/MTG Monte Carlo Deck Analyzer/i)).toBeInTheDocument();
  });

  it('displays the subtitle', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByText(/Simulation-based deck analysis/i)).toBeInTheDocument();
  });

  it('renders the Data Source panel heading', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByText(/Data Source/i)).toBeInTheDocument();
  });

  it('renders the Deck List panel heading', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByText(/Deck List/i)).toBeInTheDocument();
  });

  it('renders the Parse Deck button', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByRole('button', { name: /parse deck/i })).toBeInTheDocument();
  });

  it('renders the footer copyright notice', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByText(/All card data © Wizards of the Coast/i)).toBeInTheDocument();
  });

  it('does not show the error banner initially', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.queryByText(/⚠️/)).not.toBeInTheDocument();
  });
});

// =============================================================================
// 2 — Data Source panel
// =============================================================================
describe('Data Source panel', () => {
  it('renders the "Local JSON File" radio option', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByLabelText(/Local JSON File/i)).toBeInTheDocument();
  });

  it('renders the "Scryfall API" radio option', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByLabelText(/Scryfall API/i)).toBeInTheDocument();
  });

  it('defaults to "Local JSON File" mode', () => {
    render(<MTGMonteCarloAnalyzer />);
    const localRadio = screen.getByLabelText(/Local JSON File/i);
    expect(localRadio).toBeChecked();
  });

  it('shows the file upload input in local mode', () => {
    render(<MTGMonteCarloAnalyzer />);
    // Upload instructions heading is visible in local mode
    expect(screen.getByText(/How to get cards\.json/i)).toBeInTheDocument();
    // The file input is present (accept=".json")
    const fileInput = document.querySelector('input[type="file"][accept=".json"]');
    expect(fileInput).not.toBeNull();
  });

  it('hides the file upload input after switching to Scryfall mode', () => {
    render(<MTGMonteCarloAnalyzer />);
    const scryfallRadio = screen.getByLabelText(/Scryfall API/i);
    fireEvent.click(scryfallRadio);
    expect(document.querySelector('input[type="file"][accept=".json"]')).toBeNull();
  });

  it('marks the Scryfall radio as checked after clicking it', () => {
    render(<MTGMonteCarloAnalyzer />);
    const scryfallRadio = screen.getByLabelText(/Scryfall API/i);
    fireEvent.click(scryfallRadio);
    expect(scryfallRadio).toBeChecked();
  });
});

// =============================================================================
// 3 — Deck List panel
// =============================================================================
describe('Deck List panel', () => {
  it('renders the deck textarea', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('textarea placeholder mentions MTG Arena format', () => {
    render(<MTGMonteCarloAnalyzer />);
    const ta = screen.getByRole('textbox');
    expect(ta.placeholder).toMatch(/MTG Arena format/i);
  });

  it('textarea reflects user input', () => {
    render(<MTGMonteCarloAnalyzer />);
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: '24 Forest\n36 Lightning Bolt' } });
    expect(ta.value).toBe('24 Forest\n36 Lightning Bolt');
  });
});

// =============================================================================
// 4 — Parse Deck flow
// =============================================================================
describe('Parse Deck flow', () => {
  it('calls parseDeckList when Parse Deck is clicked', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    expect(parseDeckList).toHaveBeenCalledTimes(1);
  });

  it('passes the current deck text to parseDeckList', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '24 Forest' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    expect(parseDeckList.mock.calls[0][0]).toBe('24 Forest');
  });

  it('shows deck statistics after a successful parse', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Total Cards:\s*60/i)).toBeInTheDocument();
    });
  });

  it('shows land count after a successful parse', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Lands:\s*24/i)).toBeInTheDocument();
    });
  });

  it('shows the error banner when parseDeckList returns null', async () => {
    parseDeckList.mockResolvedValue(null);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Parsing failed/i)).toBeInTheDocument();
    });
  });

  it('shows parse errors returned inside the deck object', async () => {
    parseDeckList.mockResolvedValue({ ...MOCK_PARSED_DECK, errors: ['Unknown card: Foo'] });
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Unknown card: Foo/i)).toBeInTheDocument();
    });
  });

  it('clears a previous error when a new parse succeeds cleanly', async () => {
    // First parse fails
    parseDeckList.mockResolvedValueOnce(null);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });
    await waitFor(() => expect(screen.getByText(/Parsing failed/i)).toBeInTheDocument());

    // Second parse succeeds
    parseDeckList.mockResolvedValueOnce(MOCK_PARSED_DECK);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Parsing failed/i)).not.toBeInTheDocument();
    });
  });
});

// =============================================================================
// 5 — Run Simulation flow
// =============================================================================
describe('Run Simulation flow', () => {
  it('calls monteCarlo after parsing a deck and clicking Start Simulation', async () => {
    // After a successful parse, SimulationSettingsPanel renders with a Start Simulation button.
    // Parse a deck first, then verify monteCarlo is invoked.
    // We test the guard via the exported handler indirectly: render only (no parse).
    // The Start Simulation button is only visible after parsing, so we parse first,
    // then verify monteCarlo is called.
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    monteCarlo.mockReturnValue({
      landsPerTurn: [],
      untappedPerTurn: [],
      colorsByTurn: [],
      manaByTurn: [],
      lifeLossByTurn: [],
      stdDevByTurn: [],
      keyCardPlayability: {},
      mulligans: 0,
      handsKept: 1,
      fastestPlaySequences: [],
      hasBurstCards: false,
    });

    render(<MTGMonteCarloAnalyzer />);

    // Parse the deck so the Run Simulation button appears
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    // The Run Simulation button should now be in the document
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start simulation/i })).toBeInTheDocument();
    });

    // Click it
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start simulation/i }));
    });

    // monteCarlo should be called (inside a setTimeout—wait for it)
    await waitFor(
      () => {
        expect(monteCarlo).toHaveBeenCalledTimes(1);
      },
      { timeout: 500 }
    );
  });
});

// =============================================================================
// 6 — localStorage persistence
// =============================================================================
describe('localStorage persistence', () => {
  it('persists deck text to localStorage when the textarea changes', async () => {
    render(<MTGMonteCarloAnalyzer />);
    const ta = screen.getByRole('textbox');

    await act(async () => {
      fireEvent.change(ta, { target: { value: '4 Lightning Bolt' } });
    });

    // State is now stored under slotA.deckText (new schema)
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('mtg_mca_state') || '{}');
      expect(saved.slotA.deckText).toBe('4 Lightning Bolt');
    });
  });

  it('restores saved deck text from localStorage on mount', () => {
    localStorage.setItem('mtg_mca_state', JSON.stringify({ deckText: '4 Counterspell' }));
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByRole('textbox').value).toBe('4 Counterspell');
  });

  it('restores saved apiMode from localStorage on mount', () => {
    localStorage.setItem('mtg_mca_state', JSON.stringify({ apiMode: 'scryfall' }));
    render(<MTGMonteCarloAnalyzer />);
    const scryfallRadio = screen.getByLabelText(/Scryfall API/i);
    expect(scryfallRadio).toBeChecked();
  });

  it('falls back to defaults when localStorage is empty', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByLabelText(/Local JSON File/i)).toBeChecked();
    expect(screen.getByRole('textbox').value).toBe('');
  });

  it('persists comparisonMode to localStorage', async () => {
    render(<MTGMonteCarloAnalyzer />);
    const compareBtn = screen.getByRole('button', { name: /compare two decks/i });

    await act(async () => {
      fireEvent.click(compareBtn);
    });

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('mtg_mca_state') || '{}');
      expect(saved.comparisonMode).toBe(true);
    });
  });

  it('persists labelA to localStorage when changed in comparison mode', async () => {
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compare two decks/i }));
    });

    const [labelInputA] = screen.getAllByPlaceholderText(/Deck [AB] name/i);
    await act(async () => {
      fireEvent.change(labelInputA, { target: { value: 'Stompy' } });
    });

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('mtg_mca_state') || '{}');
      expect(saved.labelA).toBe('Stompy');
    });
  });

  it('restores comparisonMode from localStorage on mount', () => {
    localStorage.setItem('mtg_mca_state', JSON.stringify({ comparisonMode: true }));
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByRole('button', { name: /compare two decks/i }).className).toMatch(/active/i);
  });

  it('persists turns to localStorage when changed in SimulationSettingsPanel', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    // Parse so that SimulationSettingsPanel becomes visible
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    // The turns input is type="number" min="1" max="15"
    await waitFor(() => {
      expect(document.querySelector('input[type="number"][min="1"][max="15"]')).not.toBeNull();
    });

    const turnsInput = document.querySelector('input[type="number"][min="1"][max="15"]');
    await act(async () => {
      fireEvent.change(turnsInput, { target: { value: '10' } });
    });

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('mtg_mca_state') || '{}');
      expect(saved.turns).toBe(10);
    });
  });

  it('persists commanderMode to localStorage when toggled on', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    // Parse so that SimulationSettingsPanel (and the Commander Mode checkbox) appears
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /parse deck/i }));
    });

    // Commander Mode is a checkbox wrapped inside a <label>; role+name works for this pattern
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Commander Mode/i })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: /Commander Mode/i }));
    });

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('mtg_mca_state') || '{}');
      expect(saved.commanderMode).toBe(true);
    });
  });
});

// =============================================================================
// 7 — Comparison mode
// =============================================================================
describe('Comparison mode', () => {
  it('renders the Single Deck toggle button', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByRole('button', { name: /single deck/i })).toBeInTheDocument();
  });

  it('renders the Compare Two Decks toggle button', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByRole('button', { name: /compare two decks/i })).toBeInTheDocument();
  });

  it('defaults to single-deck mode (Single Deck button carries the active class)', () => {
    render(<MTGMonteCarloAnalyzer />);
    expect(screen.getByRole('button', { name: /single deck/i }).className).toMatch(/active/i);
  });

  it('clicking Compare Two Decks renders two deck textareas', async () => {
    render(<MTGMonteCarloAnalyzer />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compare two decks/i }));
    });
    const textareas = document.querySelectorAll('textarea.deck-textarea');
    expect(textareas.length).toBe(2);
  });

  it('comparison mode shows a Deck A label input with default value "Deck A"', async () => {
    render(<MTGMonteCarloAnalyzer />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compare two decks/i }));
    });
    const labelInputs = screen.getAllByPlaceholderText(/Deck [AB] name/i);
    expect(labelInputs[0].value).toBe('Deck A');
  });

  it('comparison mode shows a Deck B label input with default value "Deck B"', async () => {
    render(<MTGMonteCarloAnalyzer />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compare two decks/i }));
    });
    const labelInputs = screen.getAllByPlaceholderText(/Deck [AB] name/i);
    expect(labelInputs[1].value).toBe('Deck B');
  });

  it('clicking Single Deck after Compare reverts to single-deck mode', async () => {
    render(<MTGMonteCarloAnalyzer />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compare two decks/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /single deck/i }));
    });
    expect(screen.queryAllByPlaceholderText(/Deck [AB] name/i)).toHaveLength(0);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('first Parse Deck button in comparison mode calls parseDeckList for Deck A', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compare two decks/i }));
    });

    const [parseBtnA] = screen.getAllByRole('button', { name: /parse deck/i });
    await act(async () => {
      fireEvent.click(parseBtnA);
    });

    expect(parseDeckList).toHaveBeenCalledTimes(1);
  });

  it('second Parse Deck button in comparison mode calls parseDeckList for Deck B', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compare two decks/i }));
    });

    const [, parseBtnB] = screen.getAllByRole('button', { name: /parse deck/i });
    await act(async () => {
      fireEvent.click(parseBtnB);
    });

    expect(parseDeckList).toHaveBeenCalledTimes(1);
  });

  it('shows "Parsing failed (Deck B)" when Deck B parse returns null', async () => {
    parseDeckList.mockResolvedValue(null);
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compare two decks/i }));
    });

    const [, parseBtnB] = screen.getAllByRole('button', { name: /parse deck/i });
    await act(async () => {
      fireEvent.click(parseBtnB);
    });

    await waitFor(() => {
      expect(screen.getByText(/Parsing failed \(Deck B\)/i)).toBeInTheDocument();
    });
  });

  it('shows guard error "Please parse Deck B first" when only Deck A is parsed', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    monteCarlo.mockReturnValue({
      landsPerTurn: [],
      untappedPerTurn: [],
      colorsByTurn: [],
      manaByTurn: [],
      lifeLossByTurn: [],
      stdDevByTurn: [],
      keyCardPlayability: {},
      mulligans: 0,
      handsKept: 1,
      fastestPlaySequences: [],
      hasBurstCards: false,
    });
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compare two decks/i }));
    });

    // Parse only Deck A
    const [parseBtnA] = screen.getAllByRole('button', { name: /parse deck/i });
    await act(async () => {
      fireEvent.click(parseBtnA);
    });

    // SimulationSettingsPanel should appear after Deck A is parsed
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start simulation/i })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start simulation/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Please parse Deck B first/i)).toBeInTheDocument();
    });
  });

  it('calls monteCarlo twice when both decks are parsed and simulation runs', async () => {
    parseDeckList.mockResolvedValue(MOCK_PARSED_DECK);
    monteCarlo.mockReturnValue({
      landsPerTurn: [],
      untappedPerTurn: [],
      colorsByTurn: [],
      manaByTurn: [],
      lifeLossByTurn: [],
      stdDevByTurn: [],
      keyCardPlayability: {},
      mulligans: 0,
      handsKept: 1,
      fastestPlaySequences: [],
      hasBurstCards: false,
    });
    render(<MTGMonteCarloAnalyzer />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /compare two decks/i }));
    });

    // Parse both decks
    const [parseBtnA, parseBtnB] = screen.getAllByRole('button', { name: /parse deck/i });
    await act(async () => {
      fireEvent.click(parseBtnA);
    });
    await act(async () => {
      fireEvent.click(parseBtnB);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /start simulation/i })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start simulation/i }));
    });

    await waitFor(
      () => {
        expect(monteCarlo).toHaveBeenCalledTimes(2);
      },
      { timeout: 500 }
    );
  });
});
