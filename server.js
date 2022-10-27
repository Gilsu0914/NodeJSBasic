const express = require(`express`);
const app = express();
app.use(express.urlencoded({ extended: true }));
app.set(`view engine`, `ejs`);
app.use(`/public`, express.static(`public`)); //퍼블릭폴더 쓰겠다는 말. 이 안에 css넣으면 된다.

require("dotenv").config(); //env 환경변수 관리

//method override : 폼태그에서 put, delete 가능
const methodOverride = require(`method-override`);
app.use(methodOverride(`_method`));

//passport passport-local express-session
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");

app.use(
  session({ secret: "비밀코드", resave: true, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());

//몽고DB 아틀라스 연결
let db;
const MongoClient = require(`mongodb`).MongoClient;
MongoClient.connect(process.env.DB_URL, (error, client) => {
  if (error) {
    return console.log(error);
  }
  db = client.db(`todoapp`); //todoapp database에 연결요청

  app.listen(process.env.PORT, () => {
    console.log(`listening on 8080`);
  });
});

//멀터 라이브러리
let multer = require("multer");
const storage = multer.diskStorage({
  //하드에 저장하라는 말. memoryStorage는 램에 저장인데 이건 휘발성용도
  destination: function (req, file, cb) {
    cb(null, "./public/images"); // /public/images안에 이미지가 저장됨
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); //저장한 이미지의 파일명 설정하는 부분
  },
});

const path = require("path");
const { read } = require("fs");
const upload = multer({
  //multer를 이용한 이미지 하드에 저장하기 변수. 미들웨어처럼 사용하면 된다.
  storage: storage,
  filefilter: function (req, file, cb) {
    let ext = path.extname(file.originalname);
    if (ext !== ".png" && ext !== ".jpg" && ext !== ".jpeg") {
      return callback(new Error("PNG, JPG만 업로드하세요"));
    }
    callback(null, true);
  },
});

//메인페이지
app.get(`/`, function (요청, 응답) {
  응답.render(`index.ejs`);
});

//로그인 하기
app.get("/login", (req, res) => {
  res.render("login.ejs");
});

//로컬 방식으로 로그인 auth검사
app.post(
  "/login",
  passport.authenticate(`local`, { failureRedirect: "/fail" }),
  (req, res) => {
    res.redirect(`/mypage`);
  }
);

//로그인 검사절차
passport.use(
  new LocalStrategy(
    {
      usernameField: "id",
      passwordField: "pw",
      session: true,
      passReqToCallback: false,
    },
    function (입력한아이디, 입력한비번, done) {
      //console.log(입력한아이디, 입력한비번);
      db.collection("login").findOne(
        { id: 입력한아이디 },
        function (err, result) {
          if (err) return done(err);
          if (!result)
            return done(null, false, { message: "존재하지않는 아이디입니다." });
          if (입력한비번 == result.pw) {
            return done(null, result);
          } else {
            return done(null, false, { message: "비밀번호가 틀렸습니다." });
          }
        }
      );
    }
  )
);

//회원가입 하기
app.get("/signin", (req, res) => {
  res.render("signin.ejs");
});
app.post("/register", (req, res) => {
  db.collection("login").findOne({ id: req.body.id }, (err, result) => {
    if (result == null) {
      db.collection("login").insertOne(
        { id: req.body.id, pw: req.body.pw, nickname: req.body.nickname },
        () => {
          res.redirect("/mypage");
        }
      );
    } else if (result != null) {
      res.send("이미 사용중인 아이디입니다.");
    }
  });
});

//세션만들기
passport.serializeUser((user, done) => {
  //id를 이용해서 세션을 저장시키는 코드(로그인성공시 발동) 첫인자는 위 코드의 result다.
  done(null, user.id);
});
passport.deserializeUser((아이디, done) => {
  //이 세션 데이터를 가진 사람을 DB에서 찾아줘.
  db.collection("login").findOne({ id: 아이디 }, (err, result) => {
    done(null, result);
  });
});

//회원가입 및 로그인 했으면 마이페이지로
app.get(`/mypage`, checkLogin, (req, res) => {
  res.render("mypage.ejs", { data: req.user });
});
function checkLogin(req, res, next) {
  // (로그인 후 세션이 있으면 계속 req.user가 항상 있음)
  if (req.user) {
    next();
  } else {
    res.redirect("/");
  }
}

//로그아웃
app.get("/logout", function (req, res, next) {
  req.logout(function (err, result) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

//중고거래 글올리기
app.get(`/write`, checkLogin, (요청, 응답) => {
  응답.render(`write.ejs`);
});

app.post("/add", upload.single("productImage"), (req, res) => {
  db.collection(`counter`).findOne({ name: `게시물갯수` }, (err, result) => {
    const num = result.totalPosts;

    const insertInfo = {
      _id: num + 1,
      제목: req.body.title,
      동네위치: req.body.location,
      가격: req.body.price,
      글내용: req.body.comment,
      날짜: new Date().toLocaleDateString(),
      이미지: req.file.originalname, //이미지 추가
      작성자: req.user._id, //유저정보 추가
      작성자별명: req.user.nickname,
    };

    db.collection(`post`).insertOne(insertInfo, (error, result) => {
      db.collection(`counter`).updateOne(
        { name: `게시물갯수` },
        { $inc: { totalPosts: 1 } },
        (error, result) => {
          if (error) return console.log(error);

          res.redirect("/list");
        }
      );
    });
  });
});

//중고거래 리스트
app.get(`/list`, checkLogin, (req, res) => {
  db.collection(`post`)
    .find()
    .toArray((error, result) => {
      ///db의 post컬렉션 안의 모든 데이터 꺼내기 + array화
      if (error) {
        return console.log(error);
      }
      result.reverse();
      res.render(`list.ejs`, { data: result, user: req.user });
    });
});

//디테일페이지
app.get(`/detail/:id`, checkLogin, (req, res) => {
  db.collection(`post`).findOne(
    { _id: parseInt(req.params.id) },
    (err, result) => {
      if (err) return console.log(err);
      res.render(`detail.ejs`, { data: result });
    }
  );
});

//검색기능
app.get("/search", checkLogin, (req, res) => {
  let searchCondition = [
    {
      $search: {
        index: "titleSearch", //내가 만든 아틀라스 서치인덱스 이름
        text: {
          query: req.query.value,
          path: "제목", // 제목날짜 둘다 찾고 싶으면 ['제목', '날짜']
        },
      },
    },
  ];
  db.collection("post")
    .aggregate(searchCondition)
    .toArray((err, result) => {
      result.reverse();
      res.render("search.ejs", { data: result });
    });
});

//list에서 올린글 삭제
app.delete(`/delete`, (req, res) => {
  req.body._id = parseInt(req.body._id); //_id는 숫자화처리 해줘야한다.

  const removeInfo = {
    _id: req.body._id,
    작성자: req.user._id,
  };

  db.collection(`post`).deleteOne(removeInfo, (err, result) => {
    //req.body 자체
    if (err) {
      console.log(err);
    }
    res.status(200).send({ message: `서버로부터: 성공` });
  });
});

//list에서 올린글 수정
app.get(`/edit/:id`, checkLogin, (req, res) => {
  db.collection(`post`).findOne(
    { _id: parseInt(req.params.id) },
    (err, result) => {
      if (result.작성자별명 != req.user.nickname) {
        res.send("본인이 아닙니다.");
        console.log(err);
      } else {
        res.render(`edit.ejs`, { data: result });
      }
    }
  );
});
app.put(`/edit`, upload.single("productImage"), (req, res) => {
  let editInfo = {
    제목: req.body.title,
    동네위치: req.body.location,
    가격: req.body.price,
    글내용: req.body.comment,
    이미지: req.file.originalname,
  };

  db.collection(`post`).updateOne(
    { _id: parseInt(req.body.id) },
    { $set: editInfo },
    (err, result) => {
      if (err) return console.log(err);
      res.redirect(`/list`);
    }
  );
});

//채팅
app.post("/chat", checkLogin, (req, res) => {
  db.collection("chat").findOne(
    { member: [req.body.판매자, req.user.nickname] },
    (err, result) => {
      //이미 대화중인 상대라면 중복채팅방 생성안되게 조치해주자.
      if (result) {
        res.redirect("/chat");
      } else {
        let chatInfo = {
          member: [req.body.판매자, req.user.nickname],
          date: new Date().toLocaleDateString(),
        };

        db.collection("chat").insertOne(chatInfo, (err, result) => {
          res.send("성공");
        });
      }
    }
  );
});

app.get("/chat", checkLogin, (req, res) => {
  db.collection("chat")
    .find({ member: req.user.nickname })
    .toArray()
    .then((result) => {
      res.render("chat.ejs", { data: result, user: req.user });
    });
});

//채팅룸 -> 대화
app.post("/message", checkLogin, (req, res) => {
  const messageInfo = {
    parent: req.body.parent, //상위게시물
    content: req.body.content, //메세지 입력값
    userId: req.user.nickname,
    date: new Date().toLocaleString,
  };

  db.collection("message")
    .insertOne(messageInfo)
    .then(() => {
      console.log("메세지저장 성공");
      res.send("저장");
    });
});

app.get("/message/:id", checkLogin, (req, res) => {
  //url파라미터로 GET요청사용
  //지속적으로 응답해주기 header설정
  res.writeHead(200, {
    Connection: "keep-alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });

  db.collection("message")
    .find({ parent: req.params.id }) //url파라미터 GET요청 사용으로 가능한 req.params.id
    .toArray()
    .then((result) => {
      //방문자에게 데이터 전송해주기 //파라미터 안에 절대 띄어쓰기 하지 말자 ㅠㅠ
      res.write("event: fromserver\n"); //event: 보낼데이터의 이름\n  에시 -> .addEventlistener('fromserver', ()=>{})
      res.write("data: " + JSON.stringify(result) + "\n\n"); //data: 보낼 데이터\n\n 문자화해서 내보내주자.
    });

  //mongoDB change stream 복붙해서 쓰자. (유저가 메세지를 전송하면 화면상에 계속계속 방금 작업한 메세지를 업데이트를 해주기 위해서)
  const pipeline = [
    {
      $match: { "fullDocument.parent": req.params.id },
    },
  ]; //컬렉션 안의 원하는 doc만 감시하고 싶을 경우 'fullDocument. ~' 이렇게 써주어야 한다. 정해진 규칙이니 주의.
  const changeStream = db.collection("message").watch(pipeline); //watch()가 실시간 감시역할.
  //해당 컬렉션에 변동이 생기면 코드 실행. 즉 doc가 추가,수정,삭제 등 변동이 일어날 때.
  changeStream.on("change", (result) => {
    res.write("event: fromserver\n"); // event : <- 이런식으로 띄어쓰기 절대하지 말자... 작동안한다.
    res.write("data:" + JSON.stringify([result.fullDocument]) + "\n\n`");
  });
});

//router분리 (연습)
// app.use("/shop", require("./routes/shop.js"));
// app.use("/board/sub", require("./routes/board.js"));
