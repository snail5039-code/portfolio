package com.jetrace.backend.adminDto;

public class DataDeletionRequestResponse {
    private Long id;
    private String loginId;
    private String studentName;
    private String reason;
    private String status;
    private String requestedAt;

    public Long getId() { return id; }
    public void setId(Long v) { id = v; }
    public String getLoginId() { return loginId; }
    public void setLoginId(String v) { loginId = v; }
    public String getStudentName() { return studentName; }
    public void setStudentName(String v) { studentName = v; }
    public String getReason() { return reason; }
    public void setReason(String v) { reason = v; }
    public String getStatus() { return status; }
    public void setStatus(String v) { status = v; }
    public String getRequestedAt() { return requestedAt; }
    public void setRequestedAt(String v) { requestedAt = v; }
}
