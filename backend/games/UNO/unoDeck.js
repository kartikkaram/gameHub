/**
 * Creates a standard 108-card Uno deck.
 */
function createDeck() {
  const colors = ['red', 'yellow', 'green', 'blue'];
  const values = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'skip', 'reverse', 'drawTwo'
  ];
  const wildCards = ['wild', 'drawFour'];
  let deck = [];

  for (const color of colors) {
    // One '0' card per color
    deck.push({ color, value: '0' });

    // Two of each other card (1-9, skip, reverse, drawTwo)
    for (let i = 1; i < values.length; i++) {
      deck.push({ color, value: values[i] });
      deck.push({ color, value: values[i] });
    }
  }

  // Four of each Wild card
  for (const value of wildCards) {
    for (let i = 0; i < 4; i++) {
      deck.push({ color: 'wild', value });
    }
  }

  return deck;
}

/**
 * Shuffles a deck of cards using the Fisher-Yates algorithm.
 */
function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap
  }
  return deck;
}

// Export the functions for use in other files
module.exports = { createDeck, shuffle };