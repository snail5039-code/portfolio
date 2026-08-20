package com.example.demo.dao;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import com.example.demo.dto.TemplateUsageDto;
import com.example.demo.dto.WorkLog;

@Mapper
public interface WorkLogDao {
// 우선 맴버, 보드는 안만들어서 하드 코딩중
	@Insert("""
			insert into workLog
				set regDate = now()
					, updateDate = now()
					, title = #{workLogData.title}
					, mainContent = #{workLogData.mainContent}
					, sideContent = #{workLogData.sideContent}
					, summaryContent = #{workLogData.summaryContent}
					, memberId = #{memberId} 
					, templateId = #{workLogData.templateId}              
					, boardId = #{boardId}
			""")
	// 새로 만들어진 id 는 insert 를 실행한 그 자리에서 받아온다.
	// 예전에는 별도 쿼리(`select last_insert_id()`)로 읽었는데, 이 값은 커넥션 단위라
	// 트랜잭션이 없으면 다른 커넥션에서 실행되어 남의 글 id 나 0 을 받을 수 있었다.
	@Options(useGeneratedKeys = true, keyProperty = "workLogData.id")
	public void writeWorkLog(@Param("workLogData") WorkLog workLogData, @Param("memberId") int memberId, @Param("boardId") int boardId);

	@Select("""
			select w.*, m.loginId as writerName
				from workLog as w
				inner join member as m
				on w.memberId = m.id 
				order by id desc
			""")
	public List<WorkLog> showList();
	
	@Select("""
			select w.*, m.loginId as writerName
				from workLog as w
				inner join member as m
				on w.memberId = m.id 
				where boardId = #{boardId}
				order by id desc
			""")
	public List<WorkLog> showListByBoardId(Integer boardId);

	@Select("""
			select w.*, m.loginId as writerName
				from workLog as w
				inner join member as m
				on w.memberId = m.id 
				where w.id = #{id}
			""")
	public WorkLog showDetail(int id);
	
	@Update("""
			update workLog
				set updateDate = now()
					, title = #{modifyData.title}
					, mainContent = #{modifyData.mainContent}
					, sideContent = #{modifyData.sideContent}
					where id = #{id} and memberId = #{memberId}
			""")
	public int doModify(@Param("id") int id, @Param("memberId") int memberId,
			@Param("modifyData") WorkLog modifyData);

	@Select("""
			select count(*)
				from workLog
				where memberId = #{memberId}
			""")
	public int getMyWorkLogsCount(int memberId);
	// 카운트 안쓰면 터짐!
	@Select("""
			select count(*)
				from workLog
				where memberId = #{memberId}
				and date_format(regDate, '%y-%m') = date_format(now(), '%y-%m')
			""")
	public int getThisMonthCount(int memberId);
	
	@Select("""
			select max(regDate)
				from workLog
				where memberId = #{memberId}
			""")
	public LocalDateTime getLastWrittenDate(int memberId);
	
	@Select("""
			select templateId, count(*) as count
				from workLog
				where memberId = #{memberId}
				group by templateId
				order by count(*) desc
				limit 3 
			""")
	public List<TemplateUsageDto> getTopTemplates(int memberId);
	
	@Select("""
			select *
				from workLog
				where memberId = #{memberId}
				order by id desc
				limit #{size} offset #{offset}
			""")
	public List<WorkLog> getMyWorkLogsPaged(int memberId, int offset, int size);
	
	@Select("""
	        select w.*, m.loginId as writerName
				 from workLog as w
			     inner join member as m
			     on w.memberId = m.id
			     order by w.id desc
			     limit #{size} offset #{offset}
	        """)
	public List<WorkLog> getBoardListPagedAll(int offset, int size);
	
	@Select("""
	        select w.*, m.loginId as writerName
	        	 from workLog as w
				 inner join member as m
			     on w.memberId = m.id
			     where w.boardId = #{boardId}
			     order by w.id desc
			     limit #{size} offset #{offset}
	        """)
	public List<WorkLog> getBoardListPagedByBoard(Integer boardId, int offset, int size);

	@Select("""
	        select count(*)
	        	from workLog
	        """)
	public int getBoardListCountAll();
	
	@Select("""
	        select count(*)
	        	from workLog
	        	where boardId = #{boardId}
	        """)
	public int getBoardListCountByBoard(Integer boardId);
	
	@Select("""
			select * 
				from workLog
				where memberId = #{memberId}
					and boardId = 4
					and date(regDate) between #{s} and #{e}
				order by regDate asc
			""")
	public List<WorkLog> getLogsByDateRange(int memberId, LocalDate s, LocalDate e);

	// 인수인계서용. 기간을 비워도 되도록 양쪽 경계를 선택 조건으로 뒀다.
	// 예전에는 "최근 200건" 을 가져와 자바에서 걸렀기 때문에, 글이 200건을 넘으면
	// 오래된 기간은 존재 자체를 모른 채 빈 인수인계서가 나왔다.
	@Select("""
			select *
				from workLog
				where memberId = #{memberId}
					and boardId = 4
					and (#{s, jdbcType=DATE} is null or date(regDate) >= #{s, jdbcType=DATE})
					and (#{e, jdbcType=DATE} is null or date(regDate) <= #{e, jdbcType=DATE})
				order by regDate asc
			""")
	public List<WorkLog> getDailyLogsForHandover(@Param("memberId") int memberId, @Param("s") LocalDate s,
			@Param("e") LocalDate e);
	
	@Insert("""
			insert into workLog
				set regDate = now()
					, updateDate = now()
					, title = #{log.title}
					, mainContent = #{log.mainContent}
					, sideContent = #{log.sideContent}
					, summaryContent = #{log.summaryContent}
					, memberId = #{memberId}
					, templateId = #{log.templateId}
					, boardId = #{boardId}
			""")
	@Options(useGeneratedKeys = true, keyProperty = "log.id")
	public void writeWorkLogToBoard(@Param("log") WorkLog weeklyLog, @Param("memberId") int memberId, @Param("boardId") int boardId);
	
	@Delete("""
			delete from workLog 
				where id = #{id}
			""")
	public void deleteWorkLog(int id);
}