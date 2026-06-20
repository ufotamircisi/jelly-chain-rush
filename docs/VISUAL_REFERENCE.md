# Jelly Chain Rush Visual Reference

The main visual reference for Jelly Chain Rush is stored at:

`docs/reference/main-game-reference.png`

This image is the primary visual target for the game experience. It defines the mobile layout, candy-island mood, UI hierarchy, readable board design, floor multipliers, Candy Island progression panel, and bottom navigation.

Important: this reference is a visual direction, not a requirement to copy any copyrighted game UI. Jelly Chain Rush must keep its own original assets, layout details, icons, and branding.

## Key Visual Requirements

* Mobile portrait 9:16 layout.
* Bright premium candy island style.
* Top UI should include:
  * Level
  * Goal
  * Score
  * Energy
  * Diamonds
  * Shake count
* Main title/logo area should be similar in spirit to the reference:
  * Jelly Chain Rush
* 7x7 board is the main gameplay focus.
* Each board cell has a semi-transparent floor multiplier layer.
* Candy icons sit above the multiplier layer.
* Multipliers must be visible underneath candies.
* Multiplier values:
  * x2
  * x4
  * x8
  * x16
  * x32
  * x64
  * x128
  * x256
  * x512
  * x1000
* Candy types:
  * green gummy bear
  * purple jelly
  * red heart
  * yellow star
  * blue round candy
  * orange jelly bean
* The board should look tactical and readable.
* The board should communicate falling candy columns after SHAKE / ÇALKALA.
* The player should understand that candies drop, horizontal/vertical matches auto-blast, cascades settle, then the player swipes candies to continue.
* The board should not read as a tap-to-blast connected-cluster game.
* The player should understand: "If this candy lands on that multiplier cell, I can score more."
* The SHAKE / ÇALKALA button should be large, glossy, and central.
* The button should feel like it physically shakes the 7x7 board and starts candy rain.
* Helper text should explain:
  * "Shake to drop new candies"
  * "Candy chain in progress..."
  * "Swipe candies to match 3+"
  * "No moves left. Shake!"

## Board Motion Direction

After SHAKE / ÇALKALA, the visual language should make the gameplay loop obvious:

1. The board trembles.
2. Candy columns drop downward for roughly 3 seconds.
3. Straight horizontal or vertical 3+ matches auto-blast.
4. Cascades continue while candies fall and refill from the top.
5. When cascades stop, the player can swipe adjacent candies to create more line matches.

Floor multipliers must remain visible underneath candies throughout drops, blasts, and cascades.

## Side Panels

Side panels should show:

* goals
* special candy rule
* multiplier rewards

## Candy Island

The Candy Island section should be a scrollable green island map, not a plain list/card-only screen. It should include ocean/water around the island, candy-colored paths between buildings, and building nodes placed across the island from early small stands near the front to larger landmarks farther back.

Buildings on the map should appear as compact icon nodes with small name labels and state badges. The map should not show huge building cards covering the island. Detailed building information, including daily production, build cost, claim actions, and build actions, should open in a bottom sheet or floating detail panel above the bottom navigation.

The Candy Island map should include:

* Şeker Tezgahı
* Jelibon Standı
* Lollipop Arabası
* Dondurma Büfesi
* Şeker Dükkanı
* Şeker Fabrikası
* daily reward bubbles
* Tümünü Topla / Collect All
* daily energy and diamond production for completed buildings

If all buildings do not fit in one mobile view, the island area should scroll or pan while the bottom navigation remains fixed.

## Bottom Navigation

English:

* PLAY
* ISLAND
* MARKET

Turkish:

* OYNA
* ADA
* MARKET
