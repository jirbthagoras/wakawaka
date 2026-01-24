# AWS Amplify Deployment Workflow

A GitHub Actions workflow for automated frontend deployment to AWS Amplify.

---


## Overview

This workflow is responsible for:

- Detecting changes in the frontend/ folder
- Obtaining AWS credentials from GitHub Secrets
- Validating frontend files before deployment
- Triggering build and deployment on AWS Amplify
- Monitoring deployment status in real-time
- Sending notifications via AWS SNS

---


## Trigger Conditions

The workflow runs automatically when:

- **The workflow runs automatically when:**
- ***Changes in frontend/ folder***
- ***Changes in .github/workflows/ folder***<br/> 
- **Pull Request to master branch:**<br/>
- ***Only for changes in frontend/ folder***<br/>
- **Manual Trigger:**
- ***Can be manually triggered via GitHub Actions UI*** 

---



## Environment Variables

| Variable | Description    | Required |
|---------|---------|----------------|
| AWS_REGION    | Target AWS region (default: us-east-1) | V |
| AWS_ACCESS_KEY_ID   | AWS Access Key ID | V |
| AWS_SECRET_ACCESS_KEY | AWS Secret Access Key | V |
| AWS_SESSION_TOKEN | AWS Session Token (for temporary credentials) | V |


