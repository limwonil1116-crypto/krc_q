"use client";

// PDF 캡처용 문서 레이아웃 (A4). html-to-image 로 캡처 -> jsPDF 로 배치.
// 한글은 브라우저 폰트로 렌더링되어 그대로 캡처됨 (폰트 임베드 불필요).

type Item = {
  id: string;
  itemNo: number;
  checkItem: string;
  standard: string | null;
  contractorResult: string | null;
  contractorNote: string | null;
  supervisorResult: string | null;
  supervisorNote: string | null;
};
type Checklist = {
  id: string;
  facilityName: string | null;
  locationPart: string | null;
  workName: string | null;
  quantity: string | null;
  stage: string | null;
  items: Item[];
};
export type PdfAsset = {
  id: string;
  assetType: string;
  fileName: string;
  mimeType: string;
  caption: string | null;
  url: string;
};
export type PdfData = {
  request: {
    inspectionDate: string | null;
    requestNo: string | null;
    locationWork: string | null;
    inspectionPart: string | null;
    inspectionMatter: string | null;
    isRecheck: boolean;
    contractorAgentName: string | null;
    contractorCheckerName: string | null;
    inspectionResult: string | null;
    instruction: string | null;
    supervisorSignature: string | null;
    status: string;
  };
  meta: {
    projectName: string;
    structureName: string;
    contractorCompany: string | null;
    supervisorName: string;
  };
  checklists: Checklist[];
  assets: PdfAsset[];
  videoFrames?: string[];
};

// A4: 210 x 297mm. 화면에서 794 x 1123 px (96dpi) 기준.
const PAGE_W = 794;
const PAGE_STYLE: React.CSSProperties = {
  width: PAGE_W,
  minHeight: 1123,
  background: "#fff",
  color: "#111",
  fontFamily: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
  fontSize: 13,
  lineHeight: 1.5,
  padding: "48px 44px",
  boxSizing: "border-box",
};

function Cell({ children, w, bold, center }: { children?: React.ReactNode; w?: number; bold?: boolean; center?: boolean }) {
  return (
    <td
      style={{
        border: "1px solid #333",
        padding: "6px 8px",
        width: w,
        fontWeight: bold ? 700 : 400,
        textAlign: center ? "center" : "left",
        verticalAlign: "middle",
        background: bold ? "#f0f0f0" : "#fff",
      }}
    >
      {children}
    </td>
  );
}

export function InspectionPdfDoc({ data, pageRefs }: { data: PdfData; pageRefs: (el: HTMLDivElement | null, idx: number) => void }) {
  const { request: r, meta, checklists } = data;
  const recheck = r.isRecheck ? "(재) " : "";

  const assets = data.assets || [];
  const videoFrames = data.videoFrames || [];
  const docs = assets.filter((a) => a.assetType === "document");
  const photos = assets.filter((a) => a.assetType === "photo");
  // 사진 6개씩 페이지 분할
  const photoPages: PdfAsset[][] = [];
  for (let i = 0; i < photos.length; i += 6) photoPages.push(photos.slice(i, i + 6));

  // 페이지 인덱스: [0]=요청서, [1..cl]=체크리스트, 그다음 도면/사진/영상
  const docPageBase = 1 + checklists.length;
  const photoPageBase = docPageBase + docs.length;
  const videoPageBase = photoPageBase + photoPages.length;
  const totalPages = videoPageBase + (videoFrames.length > 0 ? 1 : 0);
  void totalPages;

  return (
    <div style={{ position: "absolute", left: -99999, top: 0 }}>
      {/* === 페이지 1: 별지 제4호 (요청서 + 결과통보) === */}
      <div ref={(el) => pageRefs(el, 0)} style={PAGE_STYLE}>
        <div style={{ textAlign: "right", fontSize: 12, color: "#666" }}>[별지 제4호 서식]</div>
        <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 800, margin: "8px 0 20px", letterSpacing: 8 }}>
          {recheck && <span style={{ color: "#c00" }}>{recheck}</span>}검 측 요 청 서
        </h2>
        <div style={{ marginBottom: 6, fontSize: 12 }}>번 호 : {r.requestNo || "20 . ."}</div>
        <div style={{ marginBottom: 6, fontSize: 12 }}>받 음 : 공사 사무소장</div>
        <p style={{ margin: "10px 0", fontSize: 12 }}>
          다음과 같은 세부공종에 대하여 검측요청 하오니 검사 후 승인하여 주시기 바랍니다.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            <tr>
              <Cell w={130} bold center>위치 및 공종</Cell>
              <Cell>{r.locationWork || ""}</Cell>
            </tr>
            <tr>
              <Cell bold center>검 측 부 위</Cell>
              <Cell>{r.inspectionPart || ""}</Cell>
            </tr>
            <tr>
              <Cell bold center>검측 요구 일시</Cell>
              <Cell>{r.inspectionDate || ""}</Cell>
            </tr>
            <tr>
              <Cell bold center>검 측 사 항</Cell>
              <Cell>{r.inspectionMatter || ""}</Cell>
            </tr>
          </tbody>
        </table>
        <p style={{ margin: "8px 0", fontSize: 11 }}>붙 임 : 검측 체크리스트, 시공사진, 도면 각1부</p>
        <div style={{ textAlign: "right", margin: "16px 0", fontSize: 13 }}>
          현장대리인 &nbsp; {r.contractorAgentName || "___________"} &nbsp; (인)
        </div>

        <hr style={{ border: "none", borderTop: "1px dashed #999", margin: "24px 0" }} />

        <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 800, margin: "8px 0 16px", letterSpacing: 6 }}>
          검 측 결 과 통 보
        </h2>
        <div style={{ marginBottom: 6, fontSize: 12 }}>번 호 : {r.requestNo || "20 . ."}</div>
        <div style={{ marginBottom: 6, fontSize: 12 }}>받 음 : {meta.contractorCompany || "○○공사"} 현장대리인 {r.contractorAgentName || "○○○"}</div>
        <p style={{ margin: "10px 0", fontSize: 12 }}>검측요청서 번호에 대한 검측결과를 다음과 같이 통보합니다.</p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <tbody>
            <tr>
              <Cell w={130} bold center>검 측 자</Cell>
              <Cell>{meta.supervisorName || ""}</Cell>
            </tr>
            <tr>
              <Cell bold center>검 측 결 과</Cell>
              <Cell>{r.inspectionResult || ""}</Cell>
            </tr>
            <tr>
              <Cell bold center>지 시 사 항</Cell>
              <Cell>{r.instruction || ""}</Cell>
            </tr>
          </tbody>
        </table>
        <p style={{ margin: "8px 0", fontSize: 11 }}>붙임 : 공사감독의 체크리스트 검측결과, 검측야장 사본</p>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, margin: "16px 0", fontSize: 13 }}>
          공사감독원 &nbsp; {meta.supervisorName || "___________"}
          {r.supervisorSignature ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.supervisorSignature} alt="서명" style={{ height: 44, marginLeft: 4 }} />
          ) : (
            <span> (인)</span>
          )}
        </div>
        {r.status !== "approved" && (
          <div style={{ textAlign: "center", color: "#c00", fontSize: 12, marginTop: 8 }}>※ 미승인 상태 (미리보기)</div>
        )}
      </div>

      {/* === 페이지 2+: 별지 제5호 체크리스트 === */}
      {checklists.map((cl, ci) => (
        <div key={cl.id} ref={(el) => pageRefs(el, 1 + ci)} style={PAGE_STYLE}>
          <div style={{ textAlign: "right", fontSize: 12, color: "#666" }}>[별지 제5호 서식]</div>
          <h2 style={{ textAlign: "center", fontSize: 20, fontWeight: 800, margin: "8px 0 16px", letterSpacing: 6 }}>
            검측 체크리스트 {cl.stage ? `(${cl.stage})` : ""}
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 10 }}>
            <tbody>
              <tr>
                <Cell w={90} bold center>시설물명</Cell>
                <Cell>{cl.facilityName || meta.structureName}</Cell>
                <Cell w={90} bold center>위치/부위</Cell>
                <Cell>{cl.locationPart || ""}</Cell>
              </tr>
              <tr>
                <Cell bold center>공종명</Cell>
                <Cell>{cl.workName || ""}</Cell>
                <Cell bold center>물량</Cell>
                <Cell>{cl.quantity || "도면 참고"}</Cell>
              </tr>
            </tbody>
          </table>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <Cell w={28} bold center>No</Cell>
                <Cell bold center>검측 항목</Cell>
                <Cell w={150} bold center>검사기준(시방/도면)</Cell>
                <Cell w={70} bold center>시공자</Cell>
                <Cell w={70} bold center>감독원</Cell>
                <Cell w={110} bold center>조치/특기사항</Cell>
              </tr>
            </thead>
            <tbody>
              {cl.items.map((it) => (
                <tr key={it.id}>
                  <Cell center>{it.itemNo}</Cell>
                  <Cell>{it.checkItem}</Cell>
                  <Cell>{it.standard || ""}</Cell>
                  <Cell center>{it.contractorResult || ""}</Cell>
                  <Cell center>{it.supervisorResult || ""}</Cell>
                  <Cell>{it.supervisorNote || it.contractorNote || ""}</Cell>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20, fontSize: 12 }}>
            <div>
              시공자 점검일자 {r.inspectionDate || "___"} &nbsp; 현장대리인 {r.contractorAgentName || "___"} (인)
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, fontSize: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              감독원 검측일자 {r.inspectionDate || "___"} &nbsp; 감 독 원 {meta.supervisorName || "___"}
              {r.supervisorSignature ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.supervisorSignature} alt="서명" style={{ height: 36 }} />
              ) : (
                <span>(인)</span>
              )}
            </div>
          </div>
          <p style={{ marginTop: 12, fontSize: 10, color: "#666" }}>
            * 검사결과 상단은 시공자 점검직원이, 하단은 감독원이 기록한다. 매몰부분 등 검측사진을 첨부한다.
          </p>
        </div>
      ))}

      {/* === 도면 페이지 === */}
      {docs.map((a, i) => (
        <div key={a.id} ref={(el) => pageRefs(el, docPageBase + i)} style={PAGE_STYLE}>
          <h2 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, margin: "0 0 16px" }}>도면 {docs.length > 1 ? i + 1 : ""}</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.url} alt={a.fileName} crossOrigin="anonymous" style={{ maxWidth: "100%", maxHeight: 980, objectFit: "contain", display: "block", margin: "0 auto", border: "1px solid #ddd" }} />
          <p style={{ textAlign: "center", fontSize: 11, color: "#666", marginTop: 8 }}>{a.caption || a.fileName}</p>
        </div>
      ))}

      {/* === 시공사진 (사진대지) === */}
      {photoPages.map((pagePhotos, pi) => (
        <div key={"ph" + pi} ref={(el) => pageRefs(el, photoPageBase + pi)} style={PAGE_STYLE}>
          <h2 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, margin: "0 0 16px" }}>
            시공 사진 {photoPages.length > 1 ? `(${pi + 1}/${photoPages.length})` : ""}
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {pagePhotos.map((a) => (
              <div key={a.id} style={{ border: "1px solid #ddd", padding: 6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.fileName} crossOrigin="anonymous" style={{ width: "100%", height: 220, objectFit: "cover" }} />
                <p style={{ fontSize: 10, color: "#666", marginTop: 4, textAlign: "center" }}>{a.caption || a.fileName}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* === 영상 주요장면 === */}
      {videoFrames.length > 0 && (
        <div ref={(el) => pageRefs(el, videoPageBase)} style={PAGE_STYLE}>
          <h2 style={{ textAlign: "center", fontSize: 18, fontWeight: 800, margin: "0 0 16px" }}>영상 주요 장면</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {videoFrames.map((src, i) => (
              <div key={i} style={{ border: "1px solid #ddd", padding: 6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={"frame" + i} style={{ width: "100%", height: 200, objectFit: "cover" }} />
                <p style={{ fontSize: 10, color: "#666", marginTop: 4, textAlign: "center" }}>장면 {i + 1}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
