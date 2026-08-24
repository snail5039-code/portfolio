package com.example.demo.dao;

import java.util.List;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.example.demo.dto.Workspace;
import com.example.demo.dto.WorkspaceInvitation;
import com.example.demo.dto.WorkspaceMember;

@Mapper
public interface WorkspaceDao {
    @Insert("""
            insert into workspace (name, slug, ownerMemberId, status)
            values (#{name}, #{slug}, #{ownerMemberId}, 'ACTIVE')
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insertWorkspace(Workspace workspace);

    @Insert("""
            insert into workspaceMember (workspaceId, memberId, role, status, joinedAt)
            values (#{workspaceId}, #{memberId}, #{role}, 'ACTIVE', now())
            """)
    void insertMembership(int workspaceId, int memberId, String role);

    @Select("""
            select w.*, wm.role as myRole
              from workspace w
              inner join workspaceMember wm on wm.workspaceId = w.id
             where wm.memberId = #{memberId} and wm.status = 'ACTIVE' and w.status = 'ACTIVE'
             order by w.name asc
            """)
    List<Workspace> findActiveWorkspaces(int memberId);

    @Select("""
            select wm.*, m.name as memberName, m.email as memberEmail
              from workspaceMember wm inner join member m on wm.memberId = m.id
             where wm.workspaceId = #{workspaceId} and wm.status = 'ACTIVE'
             order by field(wm.role, 'OWNER', 'ADMIN', 'MANAGER', 'MEMBER'), m.name
            """)
    List<WorkspaceMember> findMembers(int workspaceId);

    @Select("""
            select * from workspaceMember
             where workspaceId = #{workspaceId} and memberId = #{memberId} and status = 'ACTIVE'
            """)
    WorkspaceMember findActiveMembership(int workspaceId, int memberId);

    @Insert("""
            insert into workspaceInvitation
              (workspaceId, email, role, tokenHash, status, invitedByMemberId, expiresAt)
            values
              (#{workspaceId}, #{email}, #{role}, #{tokenHash}, 'PENDING', #{invitedByMemberId}, #{expiresAt})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insertInvitation(WorkspaceInvitation invitation);

    @Select("""
            select * from workspaceInvitation
             where tokenHash = #{tokenHash} and status = 'PENDING' and expiresAt > now()
            """)
    WorkspaceInvitation findUsableInvitation(String tokenHash);

    @Insert("""
            insert into workspaceMember
              (workspaceId, memberId, role, status, invitedByMemberId, joinedAt)
            values
              (#{invitation.workspaceId}, #{memberId}, #{invitation.role}, 'ACTIVE', #{invitation.invitedByMemberId}, now())
            on duplicate key update
              role = if(status = 'ACTIVE' or role = 'OWNER', role, values(role)), status = 'ACTIVE',
              invitedByMemberId = values(invitedByMemberId), joinedAt = coalesce(joinedAt, now()), updateDate = now()
            """)
    void acceptMembership(WorkspaceInvitation invitation, int memberId);

    @Update("""
            update workspaceInvitation set status = 'ACCEPTED', acceptedMemberId = #{memberId}, acceptedAt = now()
             where id = #{invitationId} and status = 'PENDING' and expiresAt > now()
            """)
    int markInvitationAccepted(long invitationId, int memberId);

    @Update("""
            update workspaceMember set role = #{role}, updateDate = now()
             where workspaceId = #{workspaceId} and memberId = #{memberId} and status = 'ACTIVE' and role != 'OWNER'
            """)
    int updateMemberRole(int workspaceId, int memberId, String role);

    @Insert("""
            insert into workspaceAuditLog
              (workspaceId, actorMemberId, action, resourceType, resourceId, detailsJson)
            values
              (#{workspaceId}, #{actorMemberId}, #{action}, #{resourceType}, #{resourceId}, #{detailsJson})
            """)
    void insertAudit(int workspaceId, Integer actorMemberId, String action, String resourceType,
            String resourceId, String detailsJson);
}
