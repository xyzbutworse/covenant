# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

COVENANT is public-facing. Its audience includes anyone evaluating, operating, funding, borrowing through, or learning about the protocol. Hackathon judges, lenders, borrowers, technical reviewers, and general visitors all need a clear path through the product.

## Product Purpose

COVENANT provides Creditcoin credit facilities whose later tranches become drawable only after Attestcoin proves an agreed external payment. Success means a visitor understands the mechanism, independently inspects the public evidence, and sees the resulting capital movement without trusting a private reporter.

## Positioning

COVENANT connects verified external financial obligations to enforceable Creditcoin capital state. The contract verifies source-chain receipt inclusion, decodes the covered payment fields, applies immutable covenant terms, and expands drawable credit only after satisfaction.

## Operating Context

The public web experience serves two connected jobs. Read-only pages explain the facility, proof chain, live evidence, and adversarial results without requiring a wallet. Operator surfaces support facility and covenant actions for authorized wallets on Creditcoin CC3 testnet, with Ethereum Sepolia as the demonstrated payment source.

## Capabilities and Constraints

- Preserve all live contract reads, wallet operations, source-chain and Creditcoin explorer links, attack records, and honest failure states.
- Keep live-chain evidence visually distinct from local Foundry evidence, skipped cases, and rehearsal states.
- Do not invent transactions, customers, financial performance, production-readiness claims, or unsupported proof states.
- Keep the deployed COVENANT contracts and evidence pipeline unchanged unless live verification exposes a protocol defect.
- Support desktop and mobile web visitors.

## Brand Commitments

- Product name: COVENANT.
- Headline: Credit lines that unlock only when external obligations are cryptographically proven.
- Voice: concise, technically credible, direct, and honest about limitations.
- Real evidence and financial consequence lead the story.

## Evidence on Hand

- Public repository: https://github.com/xyzbutworse/covenant
- Live judge site: https://covenant-delta.vercel.app/judge
- Deployment records: `evidence/deployments.json`
- Happy-path proof and transaction records: `evidence/happy-path/`
- Live and local adversarial records: `evidence/attacks/`
- Clean-browser verification: `evidence/site/verification.json`
- Demo recording: `evidence/site/covenant-demo-60s.mp4`

## Product Principles

- Capital movement must remain traceable to verified evidence.
- Public inspection must work without a connected wallet.
- Real, local, skipped, and failed evidence states must never blur together.
- Operational controls must remain subordinate to comprehension and trust.
- Security claims must point to concrete transactions, state, or reproducible tests.

## Accessibility & Inclusion

The interface must remain keyboard accessible, readable at mobile widths, compatible with reduced-motion preferences, and understandable without color as the only state signal.
