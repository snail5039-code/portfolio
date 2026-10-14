package com.jetrace.backend;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class StudentIdentityMigrationPlanTest {

    @Test
    void preflightDetectsAmbiguousIdentityWithoutMutatingData() throws IOException {
        String sql = Files.readString(Path.of("migrations/002_student_identity_preflight.sql"));
        String normalized = sql.toUpperCase();

        assertTrue(normalized.contains("HAVING COUNT(*) > 1"));
        assertTrue(normalized.contains("HAVING COUNT(U.LOGIN_ID) <> 1"));
        assertTrue(normalized.contains("HAVING COUNT(S.ID) <> 1"));
        assertFalse(normalized.contains("UPDATE "));
        assertFalse(normalized.contains("DELETE "));
        assertFalse(normalized.contains("INSERT "));
        assertFalse(normalized.contains("ALTER TABLE"));
    }

    @Test
    void migrationPlanDefinesSameNameAndProfileChangeAcceptanceTests() throws IOException {
        String plan = Files.readString(Path.of("STUDENT_IDENTITY_MIGRATION.md"));

        assertTrue(plan.contains("### Same-name students"));
        assertTrue(plan.contains("### Name change"));
        assertTrue(plan.contains("### Class change"));
        assertTrue(plan.contains("UNIQUE (taskId, studentLoginId)"));
        assertTrue(plan.contains("zero null identifiers"));
    }
}
