FROM mcr.microsoft.com/playwright/java:v1.61.0-noble

WORKDIR /app

COPY . .

RUN chmod +x gradlew \
    && ./gradlew --no-daemon clean bootJar -x test

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "build/libs/backend-0.0.1-SNAPSHOT.jar"]
