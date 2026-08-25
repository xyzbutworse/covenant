# FORGE 0.8 — COVENANT lock

## Core Hypothesis Contract

If a Creditcoin revolving facility can condition future draw access on Attestcoin-verified completion of specific external financial obligations, then lenders can enforce cross-chain performance covenants without trusting a centralized observer.

## Minimum Complete Proof Loop

real Sepolia USDC transfer → real Attestcoin proof → native `0x0FD2` verification → deterministic covenant policy → next Creditcoin tranche unlocks → replay/wrong obligation rejected.

## Selection Surface

A judge should understand the product in under 30 seconds:

**100 CTC facility → 20 CTC drawn → pay 5 test USDC on Sepolia → cryptographic proof → next 20 CTC unlocked. Miss the proof deadline → undrawn capital freezes.**

## Kill gate

No frontend polish counts as progress until the live source transaction → proof → Creditcoin state transition works.
