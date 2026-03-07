#!/bin/bash

# Script phục vụ CI/CD cập nhật Cassandra Database

SQL_FILE=${1:-"../chat_app_master.cql"}

echo "🚀 Bắt đầu cập nhật lại toàn bộ Cassandra Database..."

if [ ! -f "$SQL_FILE" ]; then
    echo "❌ Không tìm thấy file SQL/CQL: $SQL_FILE"
    echo "Sử dụng: ./update_cassandra.sh <file_cql>"
    exit 1
fi

echo "📦 1. Xóa container cũ và dữ liệu hiện tại..."
docker compose stop cassandra
docker compose rm -f cassandra

# Nếu có volume được tạo tự động, hãy xóa nó để reset Data
# docker volume rm chat-service_cassandra_data 2>/dev/null

echo "🔄 2. Khởi tạo lại Cassandra container..."
docker compose up -d cassandra

echo "⏳ 3. Đang chờ Cassandra khởi động hoàn tất (Có thể mất 30-60 giây)..."
# Chờ cho đến khi cqlsh có thể kết nối thành công
until docker exec cassandra cqlsh -e "DESCRIBE KEYSPACES" > /dev/null 2>&1; do
    echo -n "."
    sleep 3
done
echo ""
echo "✅ Cassandra đã sẵn sàng!"

echo "📥 4. Đang nạp lại dữ liệu (Mới nhất) từ file $SQL_FILE..."
docker cp $SQL_FILE cassandra:/tmp/init_db.cql
docker exec cassandra cqlsh -f /tmp/init_db.cql

echo "🎉 Hoàn tất quá trình cập nhật Cassandra!"
