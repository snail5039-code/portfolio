package com.example.demo.dao;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface WorkLogCollaboratorDao {

    @Insert("""
            insert into workLogCollaborator (workLogId, memberId, role)
            values (#{workLogId}, #{memberId}, 'COLLABORATOR')
            """)
    void insert(int workLogId, int memberId);

    @Delete("delete from workLogCollaborator where workLogId = #{workLogId}")
    void deleteByWorkLogId(int workLogId);

    @Select("""
            select memberId
              from workLogCollaborator
             where workLogId = #{workLogId}
             order by memberId
            """)
    List<Integer> findMemberIdsByWorkLogId(int workLogId);
}
