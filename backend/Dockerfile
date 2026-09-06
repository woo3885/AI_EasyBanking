FROM eclipse-temurin:21-jdk-noble AS builder

WORKDIR /app

COPY . .

RUN chmod +x gradlew \
    && ./gradlew --no-daemon clean bootJar -x test

FROM mcr.microsoft.com/playwright/java:v1.61.0-noble

WORKDIR /app

COPY --from=builder /opt/java/openjdk /opt/java/openjdk
COPY --from=builder /app/build/libs/backend-0.0.1-SNAPSHOT.jar /app/backend.jar

ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="${JAVA_HOME}/bin:${PATH}"
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/backend.jar"]
