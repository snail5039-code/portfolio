package com.example.demo.dao;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Select;

import java.util.List;

import com.example.demo.dto.Project;

@Mapper
public interface ProjectDao {

    @Select("""
            select count(*)
              from project
             where id = #{projectId}
               and ownerMemberId = #{memberId}
               and archivedAt is null
            """)
    int countOwnedActiveProject(int projectId, int memberId);

    @Select("""
            select *
              from project
             where ownerMemberId = #{memberId}
               and archivedAt is null
             order by status = 'ACTIVE' desc, updateDate desc, name asc
            """)
    List<Project> findMyProjects(int memberId);

    @Insert("""
            insert into project (ownerMemberId, name, description, status, color, startDate, dueDate)
            values (#{ownerMemberId}, #{name}, #{description}, 'ACTIVE', #{color}, #{startDate}, #{dueDate})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id")
    void insert(Project project);
}
