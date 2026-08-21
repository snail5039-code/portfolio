package com.jetrace.backend;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import org.junit.jupiter.api.Test;

class SchemaConsistencyTest {

    private static final List<String> DAO_TABLES = List.of(
            "users",
            "task",
            "studentRequest",
            "student",
            "taskSubmission",
            "taskAiLog",
            "similarityResult",
            "teacherProfileChangeRequest",
            "dataDeletionRequest"
    );

    @Test
    void canonicalSchemaContainsEveryDaoTableAndSafetyConstraints() throws IOException {
        String schema = Files.readString(Path.of("schema.sql"));

        for (String table : DAO_TABLES) {
            assertTrue(schema.contains("CREATE TABLE " + table + " ("), table);
        }

        assertTrue(schema.contains("FOREIGN KEY (taskId) REFERENCES task(id)"));
        assertTrue(schema.contains("FOREIGN KEY (loginId) REFERENCES users(login_id)"));
        assertTrue(schema.contains("UNIQUE (taskId, studentName)"));
        assertTrue(schema.contains("INDEX idx_users_role_approved_created"));
        assertFalse(schema.contains("DROP DATABASE"));
        assertFalse(schema.contains("'1234'"));
    }
}
