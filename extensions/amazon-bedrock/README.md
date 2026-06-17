# DaisyClaw Amazon Bedrock Provider

Official DaisyClaw provider plugin for Amazon Bedrock. It adds Bedrock model discovery, text generation, embeddings, and guardrail-aware provider routing for agents that use AWS-hosted models.

Install from DaisyClaw:

```bash
daisyclaw plugin add @daisyclaw/amazon-bedrock-provider
```

Configure AWS credentials and region through your normal DaisyClaw credential/profile setup, then select Bedrock models with the `amazon-bedrock/...` provider prefix.
