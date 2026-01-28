# AWS Amplify Deployment Workflow


## Trigger Conditions

The workflow runs automatically when:

- **The workflow runs automatically when:**
- ***Changes in .github/workflows/deploy.yml_***<br/> 
- ***Changes the path in the source code deploy.yml_ to folder frontend***<br/> 
- ***You must read the source code ***<br/>
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


