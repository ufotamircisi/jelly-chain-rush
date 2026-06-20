# Jelly Chain Rush - Game Design Document

## 1. Project Identity

**Game name:** Jelly Chain Rush
**Project folder:** JellyChainRush
**Future app id:** com.lumisoft.jellychainrush
**Genre:** Casual puzzle / candy island builder
**Main platform:** Mobile-first web game, later Android/iOS via Capacitor
**Core theme:** Shake, drop, match, blast, grow multipliers, build Candy Island.

This game is **not** a casino, slot, gambling, betting, spin, freespin, jackpot, cashout, payout, wager, or real-money game.

Allowed language:

* Level
* Goal
* Score
* Shake
* Blast
* Chain
* Combo
* Multiplier
* Energy
* Diamonds
* Booster
* Chest
* Candy Island
* Building

Forbidden visible language:

* Casino
* Slot
* Bet
* Wager
* Jackpot
* Free spins
* Cashout
* Payout
* Credit
* Stake
* Gambling

---

## 2. Core Gameplay Summary

Jelly Chain Rush is a 7x7 candy puzzle game where the player has limited shake rights per level.

Each level starts with:

* 7x7 board
* 10 shake rights
* Energy and diamond counters
* Level goals
* Persistent floor multipliers from x2 up to x1000

The player presses **SHAKE! / ÇALKALA!** to shake the board, trigger a 3-second downward candy drop / candy rain animation, and fill the board with falling candies. Visible UI must always use **SHAKE / ÇALKALA** language, never spin language.

After the falling animation stops, all 3+ horizontal or vertical line matches automatically blast. Candies fall, new candies spawn from the top, and automatic cascades continue until no line matches remain.

After all cascades end, the player can swipe adjacent candies like a match-3 game:

1. The player swipes two adjacent candies up, down, left, or right.
2. The swipe is valid only if it creates at least one horizontal or vertical 3+ line match.
3. Valid swipes swap candies, blast matches, add score, upgrade floor multipliers under blasted cells, drop candies, spawn new candies, and continue cascades automatically.
4. Invalid swipes swap back, add no score, and cost no energy or shake rights.
5. When no valid manual moves remain, the player can use SHAKE / ÇALKALA again if shake rights and energy are available.

---

## 3. Board System

Board size:

* 7 columns
* 7 rows
* 49 cells total

Each cell has two layers:

### 3.1 Floor Multiplier Layer

This is the fixed bottom layer.

Multipliers are semi-transparent, glass-like, readable tiles underneath the candies.

Multiplier path:

none -> x2 -> x4 -> x8 -> x16 -> x32 -> x64 -> x128 -> x256 -> x512 -> x1000

Important:

* Multipliers are score multipliers only.
* Multipliers never multiply diamonds, energy, money, or premium currency.
* Multipliers stay attached to board cells.
* Candies move above them.

### 3.2 Candy Icon Layer

Candy icons sit on top of the multiplier floor.

Candy types:

1. Green gummy bear
2. Purple jelly candy
3. Red heart candy
4. Yellow star candy
5. Blue round candy
6. Orange jelly bean
7. Rare Energy Star special candy

---

## 4. Shake System

Each level starts with:

* 10 shake rights

1 shake:

* Costs 10 energy
* Uses 1 shake right
* Physically shakes/trembles the 7x7 board
* Triggers a 3-second downward candy drop / candy rain animation
* Drops candies into the moving candy layer above the fixed multiplier cells

When the player presses **SHAKE! / ÇALKALA!**:

* The button should visibly respond immediately.
* The board should move left/right and slightly up/down before or during the candy drop.
* Subtle screen vibration/haptic placeholder can be added.
* Candies fall downward in columns for roughly 3 seconds.
* Floor multipliers remain attached to their board cells and do not move with candies.
* After the drop stops, automatic horizontal and vertical line-match detection begins.

The shake should feel physical and satisfying. The action is always called SHAKE / ÇALKALA in visible UI.

---

## 5. Automatic Line Match and Swipe System

### 5.1 Automatic Matches After Shake

Match detection is line-based.

A valid automatic match:

* Minimum 3 same candy icons
* Straight horizontal or vertical line only
* Diagonal does not count

After a shake drop stops:

1. Horizontal and vertical 3+ matches auto-blast.
2. Score is added.
3. Floor multiplier tiles under blasted cells upgrade.
4. Candies above fall down.
5. New candies spawn from the top.
6. New horizontal and vertical matches auto-blast again.
7. Cascades continue until no automatic matches remain.

### 5.2 Manual Player Moves

After all automatic cascades end, the player can swipe candies manually.

Swipe rules:

* Adjacent means up, down, left, or right only.
* Diagonal swaps are not valid.
* A swipe is valid only if it creates at least one 3+ horizontal or vertical line match.

Valid swipe:

1. Candies swap.
2. Matching candies blast.
3. Score is added.
4. Floor multipliers under blasted cells upgrade.
5. Candies fall.
6. New candies spawn from the top.
7. Cascades continue automatically.

Invalid swipe:

1. Candies swap briefly.
2. Candies swap back.
3. No score is added.
4. No energy is spent.
5. No shake right is spent.

This hybrid system keeps SHAKE as the dramatic candy-drop action and uses familiar match-3 swipes for player agency after cascades settle.

---

## 6. Scoring

Base score depends on line match size.

Suggested line size bonus:

* 3 candies: x1.0
* 4 candies: x1.2
* 5 candies: x1.5
* 6 candies: x2.0
* 7 candies: x2.5
* 8+ candies across simultaneous matches/cascades: x3.0

Floor multipliers under the blasted candies apply to score.

Show score popups:

* +2,400
* +6,800
* +12,500

Track the highest multiplier reached during the level.

---

## 7. Multiplier Persistence Rules

Multipliers persist for the entire active level.

Matched/blasted cells upgrade their floor multipliers.

Multiplier path:

none -> x2 -> x4 -> x8 -> x16 -> x32 -> x64 -> x128 -> x256 -> x512 -> x1000

Multipliers do **not** reset when the initial 10 shake rights are finished if the player continues with:

* Rewarded ad
* Diamonds

Multipliers reset only when:

1. The level is fully failed/restarted.
2. The level is completed and the next level starts.

This means a player who built x512 or x1000 in a level keeps it while continuing the same level.

Important:

* Multipliers are score multipliers only.
* Multipliers never affect energy, diamonds, money, or premium currency.
* Multipliers stay attached to floor cells while candies move above them.

---

## 8. Level Win and Fail Rules

The level is won immediately when all required goals are completed during a shake auto-cascade or manual swipe cascade.

It does not matter how many shake rights remain.

Example:

* Player has 10 shake rights.
* Player completes all goals on shake 4 during an automatic cascade.
* Player also reaches x1000.
* The level is won immediately.
* The player receives the x1000 reward.
* Next level starts with reset multipliers.

If 10 shake rights are used and goals are not complete:

* Show fail/continue screen.
* Player can continue using ad or diamonds.
* Continuing does not reset multipliers.

---

## 9. Continue System

When shake rights are gone and goals are incomplete:

Options:

* Rewarded ad placeholder: +1 shake
* 100 diamonds: +1 shake
* 300 diamonds: +5 shakes
* 600 diamonds: +10 shakes

Text idea:

"So close!"
"Continue with extra shakes."

Turkish:

"Çok yaklaştın!"
"Ek çalkalama ile devam et."

---

## 10. Energy System

Energy:

* Max energy starts at 100.
* 1 shake costs 10 energy.
* 100 energy equals 10 shakes.

If player lacks energy:

* Show energy refill screen.
* For MVP, use simple local refill or placeholder.
* Later balance can include time-based refill and 2-hour wait.

---

## 11. Diamonds

Diamonds are premium soft currency.

Used for:

* Extra shakes
* Future boosters
* Future island acceleration

Diamond costs:

* +1 shake = 100 diamonds
* +5 shakes = 300 diamonds
* +10 shakes = 600 diamonds

No gambling language or mechanics.

---

## 12. Rare Special Candy

Rare candy: Energy Star

Rule:

* If 4 Energy Star special candies appear or are collected in a level, give +5 shake rights.
* This should be very rare.
* It should feel like a comeback moment.

Safe text:

English:
"Lucky Drop! +5 Shakes"

Turkish:
"Şanslı Düşüş! +5 Çalkalama"

---

## 13. Level Goals

Levels are procedural/infinite.

Each level can include one or more goals.

Goal types:

1. Reach target score
2. Blast target candy count
3. Reach target multiplier
4. Blast large line matches
5. Mixed objectives

Examples:

* Reach 120,000 score
* Blast 25 purple jelly candies
* Reach x128 multiplier
* Reach x256 multiplier
* Blast 5 line matches of 5+ candies
* Reach x1000 multiplier

Difficulty should increase gradually.

---

## 14. Star Rewards

At level completion, give star reward:

* 1 star: +10 energy +10 diamonds
* 2 stars: +10 energy +15 diamonds
* 3 stars: +20 energy +20 diamonds

Star calculation can be based on:

* Remaining shake rights
* Score performance
* Goal completion quality
* Highest multiplier reached

Exact formula can be balanced later.

---

## 15. Highest Multiplier Bonus

Only the highest reached multiplier bonus is awarded.

Multiplier rewards:

* x128: +10 energy +10 diamonds
* x256: +20 energy +20 diamonds
* x512: +50 energy +50 diamonds
* x1000: +100 energy +100 diamonds + Super Chest

If player reaches x1000 and wins the level:

Show special celebration:

"MAX MULTIPLIER x1000!"
"SUPER CHEST UNLOCKED!"

Turkish:

"MAX ÇARPAN x1000!"
"SÜPER SANDIK AÇILDI!"

---

## 16. Daily Login Reward

Once per local calendar day:

* Day 1: +20 energy +10 diamonds
* Day 2: +30 energy +15 diamonds
* Day 3: +40 energy +20 diamonds
* Day 4: +50 energy +25 diamonds
* Day 5: +60 energy +30 diamonds
* Day 6: +80 energy +40 diamonds
* Day 7: +100 energy +50 diamonds + Chest

Then repeat.

Rules:

* Use local device date for MVP.
* Do not allow repeated rewards by closing and reopening the app on the same day.
* Later, server time can be added for stronger anti-cheat.

---

## 17. Candy Island Meta Progression

The player builds and repairs Candy Island.

Buildings are unlocked from smallest to biggest.

The island gives long-term progression beyond puzzle levels.

Building states:

* Locked
* Under construction
* Completed
* Daily reward ready

---

## 18. Candy Island Building Order and Daily Production

All completed buildings produce energy and diamonds once per local calendar day.

Rewards become ready at local device time 00:00.

Rewards are not automatically added. The player must enter the Island screen and claim them.

Show:

* "Ready!" / "Hazır!"
* "Collect All" / "Tümünü Topla"

Rewards only accumulate for 1 day for MVP.

Building list:

1. Candy Stand / Şeker Tezgahı
   Daily: +10 energy +10 diamonds

2. Gummy Stand / Jelibon Standı
   Daily: +20 energy +20 diamonds

3. Lollipop Cart / Lollipop Arabası
   Daily: +30 energy +30 diamonds

4. Ice Cream Booth / Dondurma Büfesi
   Daily: +40 energy +40 diamonds

5. Candy Shop / Şeker Dükkanı
   Daily: +50 energy +50 diamonds

6. Marshmallow House / Marshmallow Evi
   Daily: +60 energy +60 diamonds

7. Caramel Workshop / Karamel Atölyesi
   Daily: +70 energy +70 diamonds

8. Gummy Workshop / Jelibon Atölyesi
   Daily: +80 energy +80 diamonds

9. Color Mixing Lab / Renk Karıştırma Laboratuvarı
   Daily: +90 energy +90 diamonds

10. Energy Star Generator / Enerji Yıldızı Jeneratörü
    Daily: +100 energy +100 diamonds

11. Candy Factory / Şeker Fabrikası
    Daily: +110 energy +110 diamonds

12. Packing Center / Paketleme Merkezi
    Daily: +120 energy +120 diamonds

13. Candy Train Station / Şeker Treni Durağı
    Daily: +130 energy +130 diamonds

14. Chocolate Bridge / Çikolata Köprüsü
    Daily: +140 energy +140 diamonds

15. Candy Harbor / Şeker Limanı
    Daily: +150 energy +150 diamonds

16. Grand Candy Square / Büyük Şeker Meydanı
    Daily: +160 energy +160 diamonds

17. x1000 Multiplier Tower / x1000 Çarpan Kulesi
    Daily: +170 energy +170 diamonds

18. Mega Candy Palace / Mega Şeker Sarayı
    Daily: +200 energy +200 diamonds

---

## 19. Market Placeholder

For MVP, market is placeholder only.

Show future items:

* +1 shake = 100 diamonds
* +5 shakes = 300 diamonds
* +10 shakes = 600 diamonds
* Boosters placeholder
* Remove ads placeholder
* Diamond packs placeholder

Do not implement real IAP in first MVP.

---

## 20. Localization

Supported languages:

* en
* tr
* es
* pt
* fr
* de
* it
* id
* vi
* nl
* pl

Rules:

* Store primary language can be English.
* Game UI supports all listed languages.
* Use browser/device language if supported.
* Fallback to English.
* Add simple language selector.
* All visible UI strings must come from translation files.
* Do not hardcode visible strings in game logic.

---

## 21. Main Screens

### 21.1 Game Screen

Must include:

* Logo
* Level
* Goal
* Score
* Shake count
* Energy
* Diamonds
* 7x7 board
* Floor multipliers
* Candy icons
* Goals panel
* Shake button
* Multiplier reward info
* Bottom navigation

### 21.2 Candy Island Screen

Must include:

* Candy Island map/cards
* 18 buildings
* Building states
* Daily production
* Ready bubbles
* Collect All button

### 21.3 Market Screen

Must include:

* Diamond placeholder packs
* Extra shake purchases with diamonds
* Booster placeholders
* Remove ads placeholder

### 21.4 Settings / Language Screen

Must include:

* Language selector
* Basic settings placeholder

---

## 22. Visual Style

* Mobile portrait 9:16
* Bright candy-island world
* Glossy casual puzzle UI
* Premium but readable
* Board readability first, effects second
* Multipliers must be visible under candies
* Effects should not hide the board
* The board should clearly communicate falling candy columns after SHAKE / ÇALKALA.
* The player should understand that candies drop, line matches auto-blast, cascades settle, then swipes continue play.

## Main Visual Reference

The main visual target is stored at:

docs/reference/main-game-reference.png

The game should follow this reference for layout, candy-island mood, UI hierarchy, readable 7x7 board, floor multipliers under candies, Candy Island progression panel, and bottom navigation.

Important:
This reference is a visual direction, not a requirement to copy any copyrighted game UI. Jelly Chain Rush must keep its own original assets, layout details, icons, and branding.

Bottom navigation:

English:

* PLAY
* ISLAND
* MARKET

Turkish:

* OYNA
* ADA
* MARKET

Main action button:

English:

* SHAKE!

Turkish:

* ÇALKALA!

Helper text:

English:

* Shake to drop new candies
* Candy chain in progress...
* Swipe candies to match 3+
* No moves left. Shake!

Turkish:

* Yeni şekerler için Çalkala
* Şeker zinciri devam ediyor...
* 3+ eşleştirmek için şekerleri kaydır
* Hamle kalmadı. Çalkala!

---

## 23. Persistence

Save locally:

* Current level
* Energy
* Diamonds
* Completed buildings
* Building claim dates
* Daily login streak
* Last daily login claim date
* Language
* Basic stats
* Current active level state where needed

---

## 24. First MVP Implementation Priority

Implement in this order:

1. Project setup
2. 7x7 board
3. Candy generation
4. Shake animation
5. 3-second candy drop / candy rain animation
6. Horizontal and vertical line-match detection
7. Automatic blast and cascade resolution
8. Swipe adjacent candy controls
9. Valid/invalid swipe handling
10. Falling/spawn logic
11. Floor multiplier system
12. Score system
13. Level goals
14. Win/fail logic
15. Continue system
16. Energy/diamond system
17. Daily login reward
18. Candy Island screen
19. Building daily production
20. Market placeholder
21. Localization

---

## 25. Technical Direction

Preferred stack:

* TypeScript
* Phaser 3
* Vite
* Mobile-first HTML5
* localStorage for MVP save data

Future:

* Capacitor wrapper for Android/iOS
* AdMob rewarded ads
* IAP for diamond packs
* Server time for stronger anti-cheat

---

## 26. Development Notes

* Keep code modular.
* Keep visible text localized.
* Avoid hardcoded UI strings.
* Avoid gambling/casino terminology.
* Use placeholder visuals first.
* Polish visuals after core gameplay is fun.
* README must include setup/run instructions and core rules.
