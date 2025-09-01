
#!/bin/bash
 # Set the name of your bucket
BUCKET_NAME="new-new"
 # List all the SQL files in the subfolders of the bucket
 echo "Serching for the files a file to download!!"
SQL_FILES=$(gsutil ls "gs://${BUCKET_NAME}/docker-server-backup/**" | grep ".sql$")

 # Show a numbered list of available SQL files and prompt user to select one
echo "Select a file to download:"
select FILE in ${SQL_FILES[@]}; do
    if [ -n "$FILE" ]; then
        break;
    fi
done
 # Download the selected file using the gutil command
gsutil cp "$FILE" .

read -sp "Enter MySQL password: " MYSQL_PASSWORD
echo "Upload started"
sudo mysqldump -u kcc --password=${MYSQL_PASSWORD} --all-databases < *-docker-mysql-backup.sql
sudo rm *-docker-mysql-backup.sql