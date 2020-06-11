#!groovy​

pipeline {
    agent any
    
    options {
        timestamps() 
        skipStagesAfterUnstable()
    }

    stages {
        stage('Build') {
            steps {
                sh '''#!/usr/bin/env bash
                    export REPO_NAME="codewind-odo-extension"
                    if [ $GIT_BRANCH == "master" ]; then
                        VERSION="9.9.9999"
                    else
                        VERSION="$GIT_BRANCH"
                    fi
                    export VERSION
                    export OUTPUT_NAME="$REPO_NAME-$VERSION"

                    echo "Building codewind odo extension zip file"
                    rm -rf .git .github .gitignore Jenkinsfile
                    rm -rf bin
                    mkdir -p bin
                    curl -Lo ./bin/odo https://mirror.openshift.com/pub/openshift-v4/clients/odo/latest/odo-linux-amd64
                    if [ $? -ne 0 ]; then
                        echo "Error downloading odo binary"
                        exit 1
                    fi

                    chmod +x ./bin/odo
                    mkdir -p $OUTPUT_NAME
                    # Move all files except output folder to output folder, suppress error of moving output folder to itself
                    mv * .* $OUTPUT_NAME 2>/dev/null
                    zip $OUTPUT_NAME.zip -9 -r $OUTPUT_NAME
                    if [ $? -ne 0 ]; then
                        echo "Error zipping odo extension"
                        exit 1
                    fi

                    echo "Built codewind odo extension zip file"
                '''
            }
        } 
        
        stage('Deploy') {
            // This when clause disables PR build uploads; you may comment this out if you want your build uploaded.
            when {
                beforeAgent true
                not {
                    changeRequest()
                }
            }

            steps {
                sshagent ( ['projects-storage.eclipse.org-bot-ssh']) {
                    sh '''#!/usr/bin/env bash
                        export REPO_NAME="codewind-odo-extension"
                        if [ $GIT_BRANCH == "master" ]; then
                            VERSION="9.9.9999"
                        else
                            VERSION="$GIT_BRANCH"
                        fi
                        export VERSION
                        export OUTPUT_NAME="$REPO_NAME-$VERSION"
                        export DOWNLOAD_AREA_URL="https://archive.eclipse.org/codewind/$REPO_NAME"
                        export LATEST_DIR="latest"
                        export BUILD_INFO="build_info.properties"
                        export SSH_HOST="genie.codewind@projects-storage.eclipse.org"
                        export DEPLOY_DIR="/home/data/httpd/archive.eclipse.org/codewind/$REPO_NAME"
                        DEPLOY_BUILD_DIR="$DEPLOY_DIR/$GIT_BRANCH/$BUILD_ID"
                        DEPLOY_LATEST_DIR="$DEPLOY_DIR/$GIT_BRANCH/$LATEST_DIR"
                        BUILD_URL="$DOWNLOAD_AREA_URL/$GIT_BRANCH/$BUILD_ID"

                        # Deploy odo extension zip file to branch latest directory on Eclipse odo extension download site
                        echo "Deploying codewind odo extension zip file to $DEPLOY_LATEST_DIR"
                        ssh $SSH_HOST rm -rf $DEPLOY_LATEST_DIR
                        ssh $SSH_HOST mkdir -p $DEPLOY_LATEST_DIR
                        scp $OUTPUT_NAME.zip $SSH_HOST:$DEPLOY_LATEST_DIR/$OUTPUT_NAME.zip
                        echo "# Build date: $(date +%F-%T)" >> $BUILD_INFO
                        echo "build_info.url=$BUILD_URL" >> $BUILD_INFO
                        SHA1=$(sha1sum ${OUTPUT_NAME}.zip | cut -d ' ' -f 1)
                        echo "build_info.SHA-1=${SHA1}" >> $BUILD_INFO
                        scp $BUILD_INFO $SSH_HOST:$DEPLOY_LATEST_DIR/$BUILD_INFO
                        rm -rf $BUILD_INFO
                        echo "Deployed codewind odo extension zip file to $DEPLOY_LATEST_DIR"

                        # Deploy odo extension zip file to branch build directory on Eclipse odo extension download site
                        echo "Deploying codewind odo extension zip file to $DEPLOY_BUILD_DIR"
                        ssh $SSH_HOST rm -rf $DEPLOY_BUILD_DIR
                        ssh $SSH_HOST mkdir -p $DEPLOY_BUILD_DIR
                        scp $OUTPUT_NAME.zip $SSH_HOST:$DEPLOY_BUILD_DIR/$OUTPUT_NAME.zip
                        echo "Deployed codewind odo extension zip file to $DEPLOY_BUILD_DIR"
                    '''
                }
            }
        }
    }   
}
