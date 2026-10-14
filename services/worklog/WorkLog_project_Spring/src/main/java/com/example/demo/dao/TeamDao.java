package com.example.demo.dao;

import java.util.List;
import org.apache.ibatis.annotations.*;
import com.example.demo.dto.Team;

@Mapper
public interface TeamDao {
    @Select("""
        select t.*, tm.role as myRole from team t
        inner join teamMember tm on tm.teamId=t.id
        where t.workspaceId=#{workspaceId} and tm.memberId=#{memberId} and t.status='ACTIVE'
        order by t.name
        """)
    List<Team> findMine(int workspaceId, int memberId);

    @Insert("insert into team(workspaceId,name,description,status) values(#{workspaceId},#{name},#{description},'ACTIVE')")
    @Options(useGeneratedKeys=true, keyProperty="id")
    void insert(Team team);

    @Insert("insert into teamMember(teamId,memberId,role) values(#{teamId},#{memberId},'LEAD')")
    void addLead(int teamId, int memberId);

    @Select("select count(*) from team where id=#{teamId} and workspaceId=#{workspaceId} and status='ACTIVE'")
    int countInWorkspace(int teamId, int workspaceId);

    @Select("select count(*) from teamMember where teamId=#{teamId} and memberId=#{memberId}")
    int countMember(int teamId, int memberId);
}
