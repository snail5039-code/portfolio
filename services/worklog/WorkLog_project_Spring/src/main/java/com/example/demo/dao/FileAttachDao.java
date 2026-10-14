package com.example.demo.dao;

import java.util.List;

import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import com.example.demo.dto.FileAttach;

@Mapper
public interface FileAttachDao {
	
	@Insert("""
			insert into fileAttach
				set regDate = now()
					, updateDate = now()
					, workLogId = #{workLogId}
					, fileName = #{fileName}
					, filePath = #{filePath}
					, fileSize = #{fileSize}
			""")
	void fileInsert(FileAttach fileAttach);

	
	
	@Select("""
			select *
				from fileAttach
				where workLogId = #{workLogId}
				order by id desc
			""")
	List<FileAttach> getFilesByWorkLogId(int workLogId);
	//파일 이름가져오기!
	@Select("""
			select fileName
				from fileAttach
				where filePath = #{filePath}
			""")
	String getOriginalFilename(String filePath);


	@Select("""
	        SELECT filePath
			    FROM fileAttach
			    WHERE workLogId = #{workLogId}
			    ORDER BY id ASC
			    LIMIT 1
			""")
	String findFirstByWorkLogId(int workLogId);

	// 글이 지워질 때 같이 지운다. 스키마에 FK 도 CASCADE 도 없어서
	// 예전에는 첨부 메타가 고아로 남았다.
	@Delete("""
			delete from fileAttach
				where workLogId = #{workLogId}
			""")
	void deleteByWorkLogId(int workLogId);

}