pipeline {
    agent any

    environment {
        DOCKERHUB_CREDS = credentials('dockerhub-creds')
        BACKEND_IMAGE = "abdulmusawwir2/ats-backend:latest"
        FRONTEND_IMAGE = "abdulmusawwir2/ats-frontend:latest"
    }

    stages {

        stage('Checkout Code') {
            steps {
                git branch: 'main',
                    credentialsId: 'github-ssh',
                    url: 'git@github.com:abdulmusawwir2/ATS-RESUME-APP.git'
            }
        }

        stage('Build Backend Image') {
            steps {
                sh 'docker build -t $BACKEND_IMAGE ./backend'
            }
        }

        // stage('Build Frontend Image') {
        //     steps {
        //         sh 'docker build -t $FRONTEND_IMAGE ./frontend'
        //     }
        // }
        stage('Build Frontend Image') {
            steps {
                sh '''
                docker build --no-cache \
                -t abdulmusawwir2/ats-frontend:latest \
                ./frontend
                '''
            }
        }

        stage('Push Images to Docker Hub') {
            steps {
                sh '''
                echo $DOCKERHUB_CREDS_PSW | docker login -u $DOCKERHUB_CREDS_USR --password-stdin
                docker push $BACKEND_IMAGE
                docker push $FRONTEND_IMAGE
                '''
            }
        }

        stage('Deploy with Docker Compose') {
            steps {
                withCredentials([
                    string(credentialsId: 'google-api-key', variable: 'GOOGLE_API_KEY')
                ]) {
                    sh '''
                    export GOOGLE_API_KEY=$GOOGLE_API_KEY
                    docker compose pull
                    docker compose down
                    docker compose up -d
                    '''
                }
            }
        }

    }

    post {
        success {
            echo "Deployment successful 🚀"
        }
        failure {
            echo "Pipeline failed ❌"
        }
    }
}
