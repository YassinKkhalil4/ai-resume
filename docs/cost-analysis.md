# Cost Analysis – ~$0.02 per Tailoring Run

## Cost Drivers

| Component | Unit Cost | Avg. Units per Run | Subtotal |
|-----------|-----------|---------------------|----------|
| **OpenAI – Tailoring call** (`gpt-4o-mini`) | $0.0006 / 1k input tokens<br>$0.0024 / 1k output tokens | 1.2k input (resume + JD)<br>0.6k output (tailored JSON) | $0.00072 + $0.00144 = **$0.00216** |
| **OpenAI – Experience extraction** (only ~35% of runs) | Same rates as above | 0.8k input / 0.4k output × 0.35 probability | $[(0.00048 + 0.00096) × 0.35] = **$0.00050** |
| **Honesty scan** (Jaccard algorithm, no API) | CPU only | n/a | $0 |
| **ATS keyword analysis** (local) | CPU only | n/a | $0 |
| **Export generation** (external renderer) | $0.006 per PDF render (pay-as-you-go) | 1.0 exports per run on avg | **$0.00600** |
| **Infrastructure amortisation** (self-hosted VM @ $160/mo for 2500 runs) | $160 / 2500 | n/a | **$0.06400** per run → Allocate 20% to tailoring flow = **$0.01280** |
| **Telemetry + storage** (tmpfs) | Negligible | n/a | $0 |

**Total Estimated Cost per Run:**  
$0.00216 (tailor) + $0.00050 (extraction) + $0.00600 (export) + $0.01280 (infra allocation) = **$0.02146**  
≈ **$0.02** per résumé processed.

> When deploying on fully managed platforms (e.g., Vercel + serverless PDF), the infrastructure line item shifts to $0.008–$0.015/run depending on concurrency and reserved instances. Adjust the amortisation factor to match actual monthly volume.

## Sensitivity Analysis

| Scenario | Token Usage | Export Rate | Infra Allocation | Cost / Run |
|----------|-------------|-------------|------------------|------------|
| High JD length (2× tokens) | 2.4k input / 1.2k output | 1 export | 20% | $0.031 |
| No PDF export | Baseline tokens | 0 | 20% | $0.015 |
| Cloud-native scaling (autoscaled K8s @ $400/mo, 10k runs) | Baseline tokens | 1 export | 10% | $0.018 |

## Optimisation Levers

1. **Model Selection:** Switching to `gpt-4o-realtime-mini` or caching JD embeddings can reduce token charges when JD length dominates.
2. **Export Bundling:** Offer DOCX default (local) and defer PDF generation to user-triggered action to save $0.006/run.
3. **Session Reuse:** Re-applying the same JD to multiple resumes can reuse extracted keywords and prompts, lowering token load by ~10%.
4. **Infrastructure Right-Sizing:** For bursty workloads, move to serverless (Vercel/Cloud Run) to pay per compute-second instead of fixed VM amortisation.

