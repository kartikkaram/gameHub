const { createDeck, shuffle } = require('./unoDeck.js');

/**
 * Manages the state and logic for a single Uno game.
 */
class Game {
  constructor(players, roomId, io) {
    this.io = io; // Socket.IO server instance
    this.roomId = roomId;
    this.players = players.map(p => ({
      id: p.id,
      username: p.username,
      hand: [],
    }));

    this.deck = [];
    this.discardPile = [];
    this.currentPlayerIndex = 0;
    this.direction = 1; // 1 for clockwise, -1 for counter-clockwise
    this.currentColor = null;
    this.unoDeclared = {}; // Tracks { playerId: boolean }
    this.gameState = 'waiting'; // 'waiting', 'playing', 'finished'
  }

  // --- 1. Game Setup ---

  /**
   * Starts the game, deals cards, and handles the first card.
   */
  startGame() {
    this.deck = shuffle(createDeck());
    this.discardPile = [];
    this.currentPlayerIndex = 0;
    this.direction = 1;
    this.unoDeclared = {};
    
    // Deal 7 cards to each player
    this.players.forEach(player => {
      player.hand = this.drawCards(7);
    });

    // Flip the first card
    let firstCard = this.deck.pop();

    // Handle special first card rules
    while (firstCard.value === 'drawFour') {
      // "If the first card is a Wild Draw Four card – Return it to the Draw Pile, shuffle..."
      this.deck.push(firstCard);
      this.deck = shuffle(this.deck);
      firstCard = this.deck.pop();
    }

    this.discardPile.push(firstCard);
    this.currentColor = firstCard.color;
    this.gameState = 'playing';

    // Handle other first-card actions
    if (firstCard.color === 'wild') {
      // "If it is a Wild card... the first player... can choose whatever color"
      // We will signal the client to ask for a color.
      this.currentColor = 'wild'; // Special state
    } else {
      // Handle non-Wild action cards
      this.handleCardAction(firstCard, true);
    }
    
    console.log(`[Game ${this.roomId}] Started. First card: ${firstCard.color} ${firstCard.value}. Current player: ${this.players[this.currentPlayerIndex].username}`);
    this.broadcastGameState();
  }

  // --- 2. Core Gameplay Actions ---

  /**
   * A player attempts to play a card.
   */
  playCard(playerId, card, chosenColor) {
    const player = this.players[this.currentPlayerIndex];
    if (player.id !== playerId) {
      return this.emitError(playerId, "It's not your turn.");
    }
    
    const topCard = this.discardPile[this.discardPile.length - 1];

    if (!this.isValidPlay(card, topCard)) {
      return this.emitError(playerId, "Invalid card. Try again.");
    }

    // --- Play is Valid ---

    // Find and remove the card from player's hand
    const cardIndex = player.hand.findIndex(c => c.color === card.color && c.value === card.value);
    if (cardIndex === -1) {
      return this.emitError(playerId, "You don't have that card.");
    }
    const [playedCard] = player.hand.splice(cardIndex, 1);
    
    this.discardPile.push(playedCard);
    this.currentColor = playedCard.color; // Base color

    // Check for win
    if (player.hand.length === 0) {
      // Simplified UNO check: Did they declare it *this turn*?
      if (!this.unoDeclared[player.id]) {
        this.emitMessage(player.id, "You forgot to call UNO! You draw 2 cards.");
        player.hand.push(...this.drawCards(2));
      } else {
        return this.endRound(player); // Player wins!
      }
    }

    // Check for UNO!
    if (player.hand.length === 1) {
      this.unoDeclared[player.id] = false; // Player is now at UNO, but hasn't "called" it yet.
      this.io.to(this.roomId).emit('uno:unoStatus', { username: player.username, hasUno: true });
    }

    // Handle the action of the card
    this.handleCardAction(playedCard, false, chosenColor);

    // Move to the next player
    this.nextTurn();
    this.broadcastGameState();
  }

  /**
   * A player draws a card from the deck.
   */
  drawCard(playerId) {
    const player = this.players[this.currentPlayerIndex];
    if (player.id !== playerId) {
      return this.emitError(playerId, "It's not your turn.");
    }

    const [newCard] = this.drawCards(1);
    if (!newCard) {
      return this.emitError(playerId, "The deck is empty!"); // Should not happen
    }
    
    player.hand.push(newCard);
    
    // "If that card can be played, play it. Otherwise... the game moves on."
    // We will make this optional for the user.
    const topCard = this.discardPile[this.discardPile.length - 1];
    
    if (this.isValidPlay(newCard, topCard)) {
      // Player *can* play this card. We'll let the frontend decide.
      // We'll send a special event to this player.
      this.io.to(player.id).emit('uno:drawnCardPlayable', { card: newCard });
    } else {
      // Card is not playable, turn automatically ends.
      this.emitMessage(player.id, `You drew a ${newCard.color} ${newCard.value}. It's not playable.`);
      this.nextTurn();
    }
    
    this.broadcastGameState();
  }

  /**
   * Player passes their turn (usually after drawing a card).
   */
  passTurn(playerId) {
     const player = this.players[this.currentPlayerIndex];
    if (player.id !== playerId) {
      return this.emitError(playerId, "It's not your turn.");
    }
    this.nextTurn();
    this.broadcastGameState();
  }
  
  /**
   * Player declares UNO.
   */
  declareUno(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (player && player.hand.length === 1) {
      this.unoDeclared[player.id] = true;
      this.io.to(this.roomId).emit('uno:unoDeclared', { username: player.username });
    } else {
      this.emitError(playerId, "You can only call UNO! with one card left.");
    }
  }

  /**
   * Player chooses a color after playing a Wild.
   */
  chooseColor(playerId, color) {
    const player = this.players[this.currentPlayerIndex];
    if (player.id !== playerId && this.currentColor !== 'wild') {
      return this.emitError(playerId, "You can't choose a color right now.");
    }
    this.currentColor = color;
    this.io.to(this.roomId).emit('uno:colorChosen', { color: this.currentColor });
    
    // If this was the first card, we don't advance the turn.
    // If it was a regular play, we *do* advance.
    // This logic is simplified; we assume color is chosen *during* the playCard action.
    
    this.broadcastGameState();
  }

  // --- 3. Game Logic Helpers ---

  /**
   * Applies the effect of an action card.
   */
  handleCardAction(card, isFirstCard = false, chosenColor) {
    const nextPlayerIndex = this.getNextPlayerIndex();
    const nextPlayer = this.players[nextPlayerIndex];

    switch (card.value) {
      case 'drawTwo':
        this.emitMessage(nextPlayer.id, `You must draw 2 cards and skip your turn.`);
        nextPlayer.hand.push(...this.drawCards(2));
        this.nextTurn(); // Skip them
        break;

      case 'skip':
        this.emitMessage(nextPlayer.id, `Your turn was skipped!`);
        this.nextTurn(); // Skip them
        break;

      case 'reverse':
        if (this.players.length === 2) {
          // 2-player rule: Reverse acts like Skip
          this.emitMessage(nextPlayer.id, `Your turn was skipped!`);
          this.nextTurn();
        } else {
          this.direction *= -1;
          this.io.to(this.roomId).emit('uno:directionChanged', { 
            direction: this.direction === 1 ? 'clockwise' : 'counter-clockwise' 
          });
        }
        break;
        
      case 'wild':
        if (!isFirstCard) {
          this.currentColor = chosenColor;
          this.io.to(this.roomId).emit('uno:colorChosen', { color: this.currentColor });
        }
        break;

      case 'drawFour':
        if (!isFirstCard) {
          this.currentColor = chosenColor;
          this.io.to(this.roomId).emit('uno:colorChosen', { color: this.currentColor });
          this.emitMessage(nextPlayer.id, `You must draw 4 cards and skip your turn.`);
          nextPlayer.hand.push(...this.drawCards(4));
          this.nextTurn(); // Skip them
        }
        break;
    }
  }

  /**
   * Checks if a card play is valid.
   */
  isValidPlay(card, topCard) {
    // Wild cards are always playable
    if (card.color === 'wild') {
      return true;
    }
    // Match color or value
    return card.color === this.currentColor || card.value === topCard.value;
  }

  /**
   * Advances the turn to the next player.
   */
  nextTurn() {
    this.currentPlayerIndex = this.getNextPlayerIndex();
  }
  
  getNextPlayerIndex() {
    return (this.currentPlayerIndex + this.direction + this.players.length) % this.players.length;
  }

  /**
   * Draws a specified number of cards from the deck.
   */
  drawCards(count) {
    let cards = [];
    for (let i = 0; i < count; i++) {
      if (this.deck.length === 0) {
        this.refillDeck();
      }
      if (this.deck.length > 0) {
        cards.push(this.deck.pop());
      }
    }
    return cards;
  }

  /**
   * Refills the draw deck from the discard pile.
   */
  refillDeck() {
    if (this.deck.length > 0) return; // No need to refill

    const topCard = this.discardPile.pop(); // Keep the top card
    this.deck = shuffle(this.discardPile);
    this.discardPile = [topCard];
    
    this.io.to(this.roomId).emit('uno:deckRefilled');
    console.log(`[Game ${this.roomId}] Deck refilled from discard pile.`);
  }

  /**
   * Ends the round and announces the winner.
   */
  endRound(winner) {
    this.gameState = 'finished';
    this.io.to(this.roomId).emit('uno:roundOver', { 
      winner: winner.username,
      // We will add scoring logic here later
    });
    console.log(`[Game ${this.roomId}] Round over. Winner: ${winner.username}`);
  }

  // --- 4. Communication Helpers ---

  /**
   * Sends the full game state to all players.
   * Tailors the state so players only see their own hand.
   */
  broadcastGameState() {
    const topCard = this.discardPile[this.discardPile.length - 1];
    
    this.players.forEach(player => {
      const stateForPlayer = {
        myHand: player.hand,
        players: this.players.map(p => ({
          id: p.id,
          username: p.username,
          cardCount: p.hand.length,
          isCurrentPlayer: this.players[this.currentPlayerIndex].id === p.id,
        })),
        discardTop: topCard,
        currentColor: this.currentColor,
        direction: this.direction === 1 ? 'clockwise' : 'counter-clockwise',
        gameState: this.gameState,
      };
      
      this.io.to(player.id).emit('uno:gameState', stateForPlayer);
    });
  }

  /**
   * Sends an error message to a specific player.
   */
  emitError(playerId, message) {
    this.io.to(playerId).emit('uno:error', { message });
  }
  
  /**
   * Sends a general message to a specific player.
   */
  emitMessage(playerId, message) {
     this.io.to(playerId).emit('uno:message', { message });
  }
}

module.exports = { Game };