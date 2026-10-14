package com.example.demo.dao;

import java.time.LocalDate;
import java.util.List;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.example.demo.dto.HandoverLog;

@Mapper
public interface HandoverLogDao {
	
	@Select("""
			select h.*, m.name as confirmerName
				from handoverLog h
				left join member m on h.confirmedByMemberId = m.id
				where h.memberId = #{memberId} or h.toName = #{memberName}
				order by h.id desc
				limit #{size} offset #{offset}
			""")
	List<HandoverLog> getMyHandoverLog(Integer memberId, String memberName, int offset, int size);
	
	@Select("""
			select count(*)
				from handoverLog
				where memberId = #{memberId} or toName = #{memberName}
			""")
	int getMyHandoverLogCount(Integer memberId, String memberName);

	@Insert("""
			insert into handoverLog
				set regDate = now()
					, updateDate = now()
					, memberId = #{memberId}
					, title = #{title}
					, writerName = #{name}
					, toName = #{toName}
					, toJob = #{toJob}
					, fromJob = #{fromJob}
					, fromDate = #{fromDate}
					, toDate = #{toDate}
					, content = #{content}
			""")
	void saveHandoverLog(Integer memberId, String name, String toName, String toJob, String fromJob,
			String title, LocalDate fromDate, LocalDate toDate, String content);
	
	@Select("""
			select *
				from handoverLog
				where id = #{id}
			""")
	HandoverLog findById(int id);

	@Update("""
			update handoverLog set status = 'DELIVERED', deliveredAt = now(), updateDate = now()
			 where id = #{id} and memberId = #{memberId} and status = 'DRAFT'
			""")
	int markDelivered(int id, int memberId);

	@Update("""
			update handoverLog set status = 'CONFIRMED', confirmedAt = now(),
			       confirmedByMemberId = #{memberId}, updateDate = now()
			 where id = #{id} and toName = #{memberName} and status = 'DELIVERED'
			""")
	int markConfirmed(int id, int memberId, String memberName);

	@Update("""
			update handoverLog set status = 'COMPLETED', completedAt = now(), updateDate = now()
			 where id = #{id} and memberId = #{memberId} and status = 'CONFIRMED'
			""")
	int markCompleted(int id, int memberId);
}
