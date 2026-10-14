package com.example.demo.service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import com.example.demo.dao.FileAttachDao;
import com.example.demo.dto.FileAttach;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
public class FileAttachService {

	// 허용 확장자. 여기 없는 것은 저장하지 않는다.
	// 예전에는 검증이 없어서 report.docx.exe 도 그대로 업로드 폴더에 들어갔다.
	private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
			"hwp", "hwpx", "txt", "csv", "png", "jpg", "jpeg", "gif", "webp", "zip");

	@Value("${file.upload-dir}")
	private String uploadDir;

	private FileAttachDao fileAttachDao;
	// 의존성 주입
	public FileAttachService(FileAttachDao fileAttachDao) {
		this.fileAttachDao = fileAttachDao;
	}

	public void fileInsert(int workLogId, MultipartFile file) {

		// 클라이언트가 준 이름은 그대로 믿지 않는다. 경로 구분자를 걷어내고 파일 이름만 남긴다.
		// UUID 접두어가 선두 `../` 는 막아주지만 이름 중간의 구분자는 못 막는다.
		String originalFileName = StringUtils.getFilename(StringUtils.cleanPath(file.getOriginalFilename() == null
				? "" : file.getOriginalFilename()));

		if (originalFileName == null || originalFileName.isBlank() || originalFileName.contains("..")) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "첨부파일 이름이 올바르지 않습니다.");
		}

		String extension = StringUtils.getFilenameExtension(originalFileName);

		if (extension == null || !ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
					"허용하지 않는 파일 형식입니다: " + originalFileName);
		}

		String addressFileName = UUID.randomUUID().toString() + "_" + originalFileName; //이거는 파일 찾을 주소 할당하고 이름하고 같이 표기 하는 느낌임

		// 업로드 디렉토리가 없으면 생성.
		// mkdir() 은 한 단계만 만들고 실패해도 조용히 false 만 돌려준다.
		// upload-dir 이 여러 단계 아래일 수 있으므로 mkdirs() 를 쓰고 결과도 확인한다.
		File uploadPath = new File(uploadDir);
		if (!uploadPath.exists() && !uploadPath.mkdirs()) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
					"업로드 폴더를 만들 수 없습니다: " + uploadDir);
		}

		File dest = new File(uploadDir, addressFileName);

		// 디스크에 파일 저장
		try {
			file.transferTo(dest); //transferTo요거는 멀피파트파일의 기능 중하나 임시로 저장된것들 실제로 저장시키는 역할을 함
		} catch (IOException e) {
			// 예전에는 여기서 println 한 줄만 찍고 삼켰다. 그래서 디스크 쓰기가 실패해도
			// 호출부는 "데이터 입력 완료" 를 돌려주고 첨부만 조용히 사라졌다.
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
					"첨부파일 저장에 실패했습니다: " + originalFileName, e);
		}

		FileAttach fileAttach = new FileAttach();
		fileAttach.setWorkLogId(workLogId);
		fileAttach.setFileName(originalFileName);
		fileAttach.setFileSize(file.getSize());
		fileAttach.setFilePath(addressFileName);

		this.fileAttachDao.fileInsert(fileAttach);
	}
	public List<FileAttach> getFilesByWorkLogId(int workLogId) {
        // WorkLog 상세 조회 시 첨부 파일 정보를 함께 보여주기 위해 필요합니다.
        return this.fileAttachDao.getFilesByWorkLogId(workLogId);
    }

	public String getOriginalFilename(String filePath) {
		return fileAttachDao.getOriginalFilename(filePath);
	}

	public String getFirstStoredFilenameByWorkLogId(int workLogId) {
		return this.fileAttachDao.findFirstByWorkLogId(workLogId);
	}

	/**
	 * 글에 붙은 첨부를 DB 와 디스크에서 모두 지운다.
	 *
	 * 예전에는 글만 지워서 첨부 메타와 실제 파일이 그대로 남았다.
	 * 디스크 삭제는 트랜잭션이 되돌려주지 않으므로 DB 정리를 먼저 한다.
	 */
	public void deleteFilesByWorkLogId(int workLogId) {
		List<FileAttach> files = this.fileAttachDao.getFilesByWorkLogId(workLogId);

		this.fileAttachDao.deleteByWorkLogId(workLogId);

		if (files == null) {
			return;
		}

		for (FileAttach file : files) {
			deleteFromDisk(file.getFilePath());
		}
	}

	private void deleteFromDisk(String storedFilename) {
		if (storedFilename == null || storedFilename.isBlank()) {
			return;
		}

		Path baseDir = Paths.get(uploadDir).toAbsolutePath().normalize();
		Path target = baseDir.resolve(storedFilename).normalize();

		// 업로드 폴더 밖은 건드리지 않는다.
		if (!target.startsWith(baseDir)) {
			log.error("업로드 폴더를 벗어난 삭제 요청: {}", storedFilename);
			return;
		}

		try {
			Files.deleteIfExists(target);
		} catch (IOException e) {
			// 파일이 안 지워져도 글 삭제는 계속한다. DB 는 이미 정리됐다.
			log.error("첨부파일 삭제 실패: {}", target, e);
		}
	}
}